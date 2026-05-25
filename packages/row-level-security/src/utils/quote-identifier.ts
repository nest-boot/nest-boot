import { assertIdentifier } from "./assert-identifier";

/** Quotes a validated PostgreSQL identifier. */
export function quoteIdentifier(identifier: string) {
  assertIdentifier(identifier);

  return `"${identifier}"`;
}
