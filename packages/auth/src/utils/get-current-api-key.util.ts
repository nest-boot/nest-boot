import { RequestContext } from "@nest-boot/request-context";

import { API_KEY } from "../auth.constants.js";
import type { ApiKey } from "../types/api-key.type.js";

/** Returns the current API credential without resolving a database entity. @internal */
export function getCurrentApiKey(): ApiKey | null {
  return RequestContext.isActive()
    ? (RequestContext.get<ApiKey>(API_KEY) ?? null)
    : null;
}
