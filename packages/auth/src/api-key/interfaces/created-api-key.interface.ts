import type { ApiKey } from "../entities/api-key.entity.js";

/** API-key creation result. The plaintext key is returned only once. */
export interface CreatedApiKey<T extends ApiKey = ApiKey> {
  /** Persisted API-key entity. */
  entity: T;
  /** Plaintext API key. */
  apiKey: string;
}
