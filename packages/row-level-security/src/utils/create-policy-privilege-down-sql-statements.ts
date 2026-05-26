import { PolicyCommand } from "../enums/policy-command.enum";
import type { PolicySqlOptions } from "../interfaces/policy-sql-options.interface";
import { assertIdentifier } from "./assert-identifier";
import { escapeSqlLiteral } from "./escape-sql-literal";
import { quoteQualifiedIdentifier } from "./quote-qualified-identifier";

/** Creates SQL that revokes table and sequence privileges emitted for a policy. */
export function createPolicyPrivilegeDownSqlStatements(
  options: PolicySqlOptions,
) {
  const roles = options.roles ?? [];

  if (roles.length === 0) {
    return [];
  }

  const tableIdentifier = quoteQualifiedIdentifier(
    options.schemaName,
    options.tableName,
  );
  const roleSql = roles.map((role) => assertIdentifier(role)).join(", ");
  const command = options.command ?? PolicyCommand.ALL;
  const privileges = getTablePrivileges(command).join(", ");
  const statements = [
    `revoke ${privileges} on table ${tableIdentifier} from ${roleSql};`,
  ];

  if (requiresSequencePrivileges(command)) {
    statements.push(createSequenceRevokeSql(options, tableIdentifier, roleSql));
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
