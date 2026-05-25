export function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}
