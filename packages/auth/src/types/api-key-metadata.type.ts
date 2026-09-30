import type { ApiKey } from "./api-key.type.js";

/** API-key entity fields available without loading the credential hash. */
export type ApiKeyMetadata<Key extends ApiKey = ApiKey> = Key extends ApiKey
  ? Omit<Key, "key">
  : never;
