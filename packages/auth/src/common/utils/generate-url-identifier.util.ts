import { randomBytes, randomInt } from "node:crypto";

import { URL_IDENTIFIER_MAX_LENGTH } from "./url-identifier.util.js";

/**
 * Generates a valid random workspace slug at the maximum length.
 * @returns A lowercase handle beginning with an ASCII letter.
 */
export function generateUrlIdentifier(): string {
  const suffixLength = URL_IDENTIFIER_MAX_LENGTH - 1;
  return `${String.fromCharCode(97 + randomInt(26))}${randomBytes(
    Math.ceil(suffixLength / 2),
  )
    .toString("hex")
    .slice(0, suffixLength)}`;
}
