import type {
  ApiKeyOwnerMap,
  ApiKeyRecord,
  OwnedApiKey,
} from "../entities/api-key.entity.js";

/**
 * Narrows a persisted credential to its validated polymorphic owner.
 * @param key - Native credential loaded from the shared table.
 * @param kind - Expected owning identity kind.
 * @internal
 */
export function assertApiKeyOwner<Kind extends keyof ApiKeyOwnerMap>(
  key: ApiKeyRecord,
  kind: Kind,
): asserts key is OwnedApiKey<Kind> {
  if (key.ownerType !== kind) {
    throw new Error("Invalid API-key owner");
  }
}
