import { PolicyCommand } from "../enums/policy-command.enum";
import type { PolicySqlOptions } from "../interfaces/policy-sql-options.interface";
import { assertIdentifier } from "./assert-identifier";
import { escapeSqlLiteral } from "./escape-sql-literal";
import { quoteQualifiedIdentifier } from "./quote-qualified-identifier";

/**
 * Creates SQL that revokes table and sequence privileges emitted for a policy.
 *
 * Preserved policies keep overlapping privileges for the same schema, table,
 * and role from being revoked during rollback.
 */
export function createPolicyPrivilegeDownSqlStatements(
  options: PolicySqlOptions,
  preservedPolicies: PolicySqlOptions[] = [],
) {
  const roles = getPolicySqlRoleNames(options.roles);

  if (roles.length === 0) {
    return [];
  }

  const tableIdentifier = quoteQualifiedIdentifier(
    options.schemaName,
    options.tableName,
  );
  const command = options.command ?? PolicyCommand.ALL;
  const statements = createTablePrivilegeRevokeSqlStatements(
    options,
    tableIdentifier,
    roles,
    preservedPolicies,
  );

  if (requiresSequencePrivileges(command)) {
    const sequenceRevokeRoles = roles.filter(
      (role) =>
        !hasPreservedSequencePrivileges(options, role, preservedPolicies),
    );

    if (sequenceRevokeRoles.length > 0) {
      statements.push(
        createSequenceRevokeSql(
          options,
          tableIdentifier,
          sequenceRevokeRoles.join(", "),
        ),
      );
    }
  }

  return statements;
}

function createTablePrivilegeRevokeSqlStatements(
  options: PolicySqlOptions,
  tableIdentifier: string,
  roles: string[],
  preservedPolicies: PolicySqlOptions[],
) {
  const command = options.command ?? PolicyCommand.ALL;
  const privileges = getTablePrivileges(command);
  const rolesByPrivileges = new Map<string, string[]>();

  for (const role of roles) {
    const preservedPrivileges = getPreservedTablePrivileges(
      options,
      role,
      preservedPolicies,
    );
    const revocablePrivileges = privileges.filter(
      (privilege) => !preservedPrivileges.has(privilege),
    );

    if (revocablePrivileges.length === 0) {
      continue;
    }

    const privilegeSql = revocablePrivileges.join(", ");
    const groupedRoles = rolesByPrivileges.get(privilegeSql) ?? [];

    groupedRoles.push(role);
    rolesByPrivileges.set(privilegeSql, groupedRoles);
  }

  return [...rolesByPrivileges].map(
    ([privilegeSql, groupedRoles]) =>
      `revoke ${privilegeSql} on table ${tableIdentifier} from ${groupedRoles.join(", ")};`,
  );
}

function getTablePrivileges(command: PolicyCommand) {
  if (command === PolicyCommand.SELECT) {
    return ["select"];
  }

  if (command === PolicyCommand.INSERT) {
    return ["insert"];
  }

  if (command === PolicyCommand.UPDATE) {
    return ["select", "update"];
  }

  if (command === PolicyCommand.DELETE) {
    return ["select", "delete"];
  }

  return ["select", "insert", "update", "delete"];
}

function requiresSequencePrivileges(command: PolicyCommand) {
  return command === PolicyCommand.INSERT || command === PolicyCommand.ALL;
}

function getPreservedTablePrivileges(
  options: PolicySqlOptions,
  role: string,
  preservedPolicies: PolicySqlOptions[],
) {
  const privileges = new Set<string>();

  for (const preservedPolicy of getPreservedPoliciesForRole(
    options,
    role,
    preservedPolicies,
  )) {
    for (const privilege of getTablePrivileges(
      preservedPolicy.command ?? PolicyCommand.ALL,
    )) {
      privileges.add(privilege);
    }
  }

  return privileges;
}

function hasPreservedSequencePrivileges(
  options: PolicySqlOptions,
  role: string,
  preservedPolicies: PolicySqlOptions[],
) {
  return getPreservedPoliciesForRole(options, role, preservedPolicies).some(
    (preservedPolicy) =>
      requiresSequencePrivileges(preservedPolicy.command ?? PolicyCommand.ALL),
  );
}

function getPreservedPoliciesForRole(
  options: PolicySqlOptions,
  role: string,
  preservedPolicies: PolicySqlOptions[],
) {
  return preservedPolicies.filter(
    (preservedPolicy) =>
      isSamePolicyTarget(options, preservedPolicy) &&
      getPolicySqlRoleNames(preservedPolicy.roles).includes(role),
  );
}

function getPolicySqlRoleNames(roles: string[] | undefined) {
  return [...new Set((roles ?? []).map((role) => assertIdentifier(role)))];
}

function isSamePolicyTarget(left: PolicySqlOptions, right: PolicySqlOptions) {
  return (
    left.schemaName === right.schemaName && left.tableName === right.tableName
  );
}

function createSequenceRevokeSql(
  options: PolicySqlOptions,
  tableIdentifier: string,
  roleSql: string,
) {
  const tableLiteral = escapeSqlLiteral(tableIdentifier);
  const schemaName = escapeSqlLiteral(options.schemaName);
  const tableName = escapeSqlLiteral(options.tableName);

  return /* SQL */ `do $$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('${tableLiteral}', columns.column_name) from information_schema.columns where columns.table_schema = '${schemaName}' and columns.table_name = '${tableName}' and pg_get_serial_sequence('${tableLiteral}', columns.column_name) is not null loop execute format('revoke usage, select on sequence %s from ${roleSql}', sequence_identifier); end loop; end $$;`;
}
