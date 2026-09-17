import type { ApiKey } from "../entities/api-key.entity.js";

/** API-key creation result. The plaintext key is returned only once. */
export interface CreatedApiKey {
  /** Persisted API-key entity. */
  entity: ApiKey;
  /** Plaintext API key. */
  apiKey: string;
}
