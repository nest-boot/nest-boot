import { assertIdentifier } from "./assert-identifier.js";

/** Quotes a validated PostgreSQL identifier. */
export function quoteIdentifier(identifier: string) {
  assertIdentifier(identifier);

  return `"${identifier}"`;
}
