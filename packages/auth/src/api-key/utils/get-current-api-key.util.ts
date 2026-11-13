import { RequestContext } from "@nest-boot/request-context";

import { ApiKey, type ApiKeyRecord } from "../entities/api-key.entity.js";

/**
 * Returns the authenticated ORM credential without loading its hash.
 * @returns API key metadata for this request, or null for other authentication methods.
 * @internal
 */
export function getCurrentApiKey(): ApiKeyRecord | null {
  return RequestContext.isActive()
    ? (RequestContext.get<ApiKeyRecord>(ApiKey) ?? null)
    : null;
}
