import type { ApiKey } from "../entities/api-key.entity.js";
import type { ApiKeyObject } from "../objects/api-key.object.js";
import { SystemApiKey } from "../objects/system-api-key.object.js";
import { UserApiKey } from "../objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";

const views = {
  user: UserApiKey,
  member: WorkspaceApiKey,
  system_account: SystemApiKey,
};

/**
 * Resolves the public credential type for authorization and GraphQL.
 * @param ownerType - Concrete identity kind.
 * @returns Public DTO constructor.
 * @internal
 */
export function getApiKeyView(ownerType: keyof typeof views) {
  return views[ownerType];
}

/**
 * Copies credential metadata into an ordinary DTO without hashes or ORM state.
 * @param entity - Persisted credential or existing DTO to snapshot.
 * @returns Owner-specific credential-free DTO.
 */
export function toApiKeyView(entity: UserApiKey): UserApiKey;
export function toApiKeyView(entity: WorkspaceApiKey): WorkspaceApiKey;
export function toApiKeyView(entity: SystemApiKey): SystemApiKey;
export function toApiKeyView(
  entity: ApiKey | ApiKeyObject,
): UserApiKey | WorkspaceApiKey | SystemApiKey;
export function toApiKeyView(
  entity: ApiKey | ApiKeyObject,
): UserApiKey | WorkspaceApiKey | SystemApiKey {
  const View = getApiKeyView(entity.ownerType);
  return new View(entity);
}
