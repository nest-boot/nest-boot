import { PolicyCommand } from "../enums/policy-command.enum.js";
import { PolicyMode } from "../enums/policy-mode.enum.js";
import type { PolicySqlOptions } from "../interfaces/policy-sql-options.interface.js";
import { assertIdentifier } from "./assert-identifier.js";
import { escapeSqlLiteral } from "./escape-sql-literal.js";
import { quoteQualifiedIdentifier } from "./quote-qualified-identifier.js";

/** Creates SQL statements that enable RLS and recreate a PostgreSQL policy. */
export function createPolicyUpSqlStatements(options: PolicySqlOptions) {
  const tableIdentifier = quoteQualifiedIdentifier(
    options.schemaName,
    options.tableName,
  );
  const policyName = assertIdentifier(options.policyName);
  const mode = options.mode ?? PolicyMode.PERMISSIVE;
  const command = options.command ?? PolicyCommand.ALL;
  const roles = options.roles ?? [];
  const roleSql = roles.map((role) => assertIdentifier(role)).join(", ");
  const predicates = getPolicyPredicates(options);

  return [
    `alter table ${tableIdentifier} enable row level security;`,
    ...createPrivilegeGrantSqlStatements(options, tableIdentifier, roleSql),
    `drop policy if exists ${policyName} on ${tableIdentifier};`,
    `create policy ${policyName} on ${tableIdentifier} as ${mode} for ${command}${roleSql ? ` to ${roleSql}` : ""} ${getPolicyPredicateSql(command, predicates)};`,
  ];
}

function createPrivilegeGrantSqlStatements(
  options: PolicySqlOptions,
  tableIdentifier: string,
  roleSql: string,
) {
  if (!roleSql) {
    return [];
  }

  const command = options.command ?? PolicyCommand.ALL;
  const privileges = getTablePrivileges(command).join(", ");
  const statements = [
    `grant ${privileges} on table ${tableIdentifier} to ${roleSql};`,
  ];

  if (requiresSequencePrivileges(command)) {
    statements.push(createSequenceGrantSql(options, tableIdentifier, roleSql));
  }

  return statements;
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

function createSequenceGrantSql(
  options: PolicySqlOptions,
  tableIdentifier: string,
  roleSql: string,
) {
  const tableLiteral = escapeSqlLiteral(tableIdentifier);
  const schemaName = escapeSqlLiteral(options.schemaName);
  const tableName = escapeSqlLiteral(options.tableName);

  return /* SQL */ `do $$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('${tableLiteral}', columns.column_name) from information_schema.columns where columns.table_schema = '${schemaName}' and columns.table_name = '${tableName}' and pg_get_serial_sequence('${tableLiteral}', columns.column_name) is not null loop execute format('grant usage, select on sequence %s to ${roleSql}', sequence_identifier); end loop; end $$;`;
}

function getPolicyPredicates(options: PolicySqlOptions) {
  const command = options.command ?? PolicyCommand.ALL;
  const predicates = {
    using: normalizeExpression(options.using),
    withCheck: normalizeExpression(options.withCheck),
  };

  assertPolicyPredicates(command, predicates);

  return predicates;
}

function normalizeExpression(expression: string | undefined) {
  const normalized = expression?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized;
}

function assertPolicyPredicates(
  command: PolicyCommand,
  predicates: { using?: string; withCheck?: string },
) {
  if (command === PolicyCommand.SELECT || command === PolicyCommand.DELETE) {
    if (!predicates.using) {
      throw new Error("Policy using expression is required");
    }

    if (predicates.withCheck) {
      throw new Error(`Policy withCheck is not allowed for ${command}`);
    }

    return;
  }

  if (command === PolicyCommand.INSERT) {
    if (predicates.using) {
      throw new Error("Policy using is not allowed for insert");
    }

    if (!predicates.withCheck) {
      throw new Error("Policy withCheck expression is required");
    }

    return;
  }

  if (!predicates.using && !predicates.withCheck) {
    throw new Error("Policy using or withCheck expression is required");
  }
}

function getPolicyPredicateSql(
  command: PolicyCommand,
  predicates: { using?: string; withCheck?: string },
) {
  const fragments: string[] = [];

  if (command !== PolicyCommand.INSERT && predicates.using) {
    fragments.push(`using ${createPredicateExpressionSql(predicates.using)}`);
  }

  if (
    command !== PolicyCommand.SELECT &&
    command !== PolicyCommand.DELETE &&
    predicates.withCheck
  ) {
    fragments.push(
      `with check ${createPredicateExpressionSql(predicates.withCheck)}`,
    );
  }

  return fragments.join(" ");
}

function createPredicateExpressionSql(expression: string) {
  return isParenthesizedExpression(expression) ? expression : `(${expression})`;
}

function isParenthesizedExpression(expression: string) {
  return expression.startsWith("(") && expression.endsWith(")");
}
