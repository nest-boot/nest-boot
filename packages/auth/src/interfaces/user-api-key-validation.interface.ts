import type { User } from "../entities/user.entity.js";
import type { UserApiKey } from "../entities/user-api-key.entity.js";

/** Successful authentication for a user-owned API key. */
export interface UserApiKeyValidation {
  /** Validated API-key entity. */
  apiKey: UserApiKey;
  /** Identifies the owner branch. */
  ownerType: "user";
  /** User represented by the key. */
  user: User;
}
