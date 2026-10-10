import { RequestContext } from "@nest-boot/request-context";

import { API_KEY } from "../auth.constants.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/**
 * Returns the current API credential without resolving a database entity.
 * @returns API key metadata for this request, or null for other authentication methods.
 * @internal
 */
export function getCurrentApiKey(): ApiKeyMetadata | null {
  return RequestContext.isActive()
    ? (RequestContext.get<ApiKeyMetadata>(API_KEY) ?? null)
    : null;
}
