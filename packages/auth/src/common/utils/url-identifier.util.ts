import { z } from "zod";

export const URL_IDENTIFIER_MIN_LENGTH = 3;
export const URL_IDENTIFIER_MAX_LENGTH = 30;
export const URL_IDENTIFIER_PATTERN = "^[a-z][a-z0-9]*(-[a-z0-9]+)*$";

/** Trims and validates a lowercase workspace slug or username. */
export const urlIdentifierSchema = z
  .string()
  .trim()
  .min(URL_IDENTIFIER_MIN_LENGTH)
  .max(URL_IDENTIFIER_MAX_LENGTH)
  .regex(new RegExp(URL_IDENTIFIER_PATTERN));

/**
 * Builds the database CHECK for an already-normalized identifier.
 * @param column - Column name supplied by MikroORM entity metadata.
 * @returns PostgreSQL expression enforcing length and ASCII format.
 */
export function urlIdentifierCheckExpression(column: string): string {
  const identifier = `"${column.replaceAll('"', '""')}"`;
  // C collation keeps character ranges ASCII-only across database locales.
  return `char_length(${identifier}) >= ${String(URL_IDENTIFIER_MIN_LENGTH)} and char_length(${identifier}) <= ${String(URL_IDENTIFIER_MAX_LENGTH)} and ${identifier} collate "C" ~ '${URL_IDENTIFIER_PATTERN}'`;
}
