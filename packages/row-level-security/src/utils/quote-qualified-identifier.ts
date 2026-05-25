import { quoteIdentifier } from "./quote-identifier";

export function quoteQualifiedIdentifier(
  schemaName: string,
  tableName: string,
) {
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
}
