/** Escapes a string for use inside a single-quoted SQL literal. */
export function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}
