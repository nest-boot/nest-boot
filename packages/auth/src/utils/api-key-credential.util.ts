import { createHash, randomBytes } from "node:crypto";

import { BadRequestException } from "@nestjs/common";

/** Hashes a high-entropy API credential for lookup. @internal */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("base64url");
}

/** Generates a credential with a validated public prefix. @internal */
export function generateApiKey(prefix: string): string {
  if (
    prefix.length > 32 ||
    !/^[a-z]/u.test(prefix) ||
    /[^a-z0-9]/u.test(prefix)
  ) {
    throw new BadRequestException(
      "API key prefix must contain 1–32 lowercase letters or digits and start with a lowercase letter",
    );
  }
  return `${prefix}${randomBytes(48).toString("base64url")}`;
}
