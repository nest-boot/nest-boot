import { assertIdentifier } from "./assert-identifier";

export function quoteIdentifier(identifier: string) {
  assertIdentifier(identifier);

  return `"${identifier}"`;
}
