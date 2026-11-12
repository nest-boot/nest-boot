import type { ApiKeyObject } from "../objects/api-key.object.js";

/** Credential-free, owner-specific GraphQL response metadata. */
export type ApiKeyMetadata<Key extends ApiKeyObject = ApiKeyObject> = Key;
