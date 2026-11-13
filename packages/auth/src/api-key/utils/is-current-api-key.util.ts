import type { ApiKey } from "../entities/api-key.entity.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";
/**
 * Whether a credential authenticates this request.
 * @param apiKey - Credential identifying the current request.
 * @returns Result of the requested operation.
 */
export function isCurrentApiKey(
  apiKey: Pick<ApiKey, "id" | "ownerType">,
): boolean {
  const current = getCurrentApiKey();
  return (
    !!current &&
    current.ownerType === apiKey.ownerType &&
    current.id === apiKey.id
  );
}
