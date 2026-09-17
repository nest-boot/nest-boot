import type { ApiKey } from "../entities/api-key.entity.js";
import type { User } from "../entities/user.entity.js";

/** Successful authentication for a user-owned API key. */
export interface UserApiKeyValidation {
  /** Validated API-key entity. */
  apiKey: ApiKey;
  /** Identifies the owner branch. */
  ownerType: "user";
  /** User represented by the key. */
  user: User;
}
