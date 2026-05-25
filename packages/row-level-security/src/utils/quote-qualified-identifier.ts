import { quoteIdentifier } from "./quote-identifier";

/** Quotes a schema-qualified PostgreSQL table identifier. */
export function quoteQualifiedIdentifier(
  schemaName: string,
  tableName: string,
) {
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
}
