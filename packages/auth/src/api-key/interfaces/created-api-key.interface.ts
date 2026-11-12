import type { ApiKeyObject } from "../objects/api-key.object.js";

/** API-key creation result. The plaintext key is returned only once. */
export interface CreatedApiKey<T extends ApiKeyObject = ApiKeyObject> {
  /** Created credential metadata without its hash. */
  entity: T;
  /** Plaintext API key. */
  apiKey: string;
}
