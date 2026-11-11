import type { ApiKey } from "../entities/api-key.entity.js";

/**
 * API-key fields without the credential hash.
 * Management services return snapshots; use service methods to persist changes.
 */
export type ApiKeyMetadata<Key extends ApiKey = ApiKey> = Key extends ApiKey
  ? Omit<Key, "key">
  : never;
