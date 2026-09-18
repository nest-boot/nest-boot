import type { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { BadRequestException } from "@nestjs/common";

import { API_KEY } from "../auth.constants.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import type { ApiKey } from "../types/api-key.type.js";
import { clearRequestAuthentication } from "./clear-request-authentication.util.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";
import { refreshRequestAuthorization } from "./refresh-request-authorization.util.js";

/** Matches both the table and ID; user and workspace key identifiers may coincide. */
function isCurrentApiKey(apiKey: ApiKey): boolean {
  const current = getCurrentApiKey();
  return (
    !!current &&
    current.constructor === apiKey.constructor &&
    current.id === apiKey.id
  );
}

/** Prevents publishing credential changes before an outer transaction commits. */
export function assertCurrentApiKeyCanCommit(
  em: EntityManager,
  apiKey: ApiKey,
): void {
  if (isCurrentApiKey(apiKey) && em.isInTransaction()) {
    throw new BadRequestException(
      "Change the authenticating API key outside an active transaction",
    );
  }
}

/** Publishes committed credential changes and retains the credential permission ceiling. */
export function refreshCurrentApiKeyAuthorization(
  em: EntityManager,
  options: AuthModuleOptions,
  apiKey: ApiKey,
  deleted = false,
): void {
  if (!isCurrentApiKey(apiKey)) return;
  if (
    deleted ||
    !apiKey.enabled ||
    (apiKey.expiresAt && apiKey.expiresAt <= new Date())
  ) {
    clearRequestAuthentication(em);
    return;
  }
  RequestContext.set(API_KEY, apiKey);
  refreshRequestAuthorization(em, options);
}
