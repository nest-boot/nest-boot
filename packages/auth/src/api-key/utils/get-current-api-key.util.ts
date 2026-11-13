import { RequestContext } from "@nest-boot/request-context";

import { API_KEY } from "../../core/constants/auth.constants.js";
import type { ApiKeyObject } from "../objects/api-key.object.js";

/**
 * Returns the current API credential without resolving a database entity.
 * @returns API key metadata for this request, or null for other authentication methods.
 * @internal
 */
export function getCurrentApiKey(): ApiKeyObject | null {
  return RequestContext.isActive()
    ? (RequestContext.get<ApiKeyObject>(API_KEY) ?? null)
    : null;
}
