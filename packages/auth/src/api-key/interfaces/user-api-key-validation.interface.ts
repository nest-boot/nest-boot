import type { User } from "../../core/entities/user.entity.js";
import type { UserApiKey } from "../objects/user-api-key.object.js";

/** Successful authentication for a user-owned API key. */
export interface UserApiKeyValidation {
  /** Validated API-key entity. */
  apiKey: UserApiKey;
  /** Identifies the owner branch. */
  ownerType: "user";
  /** User represented by the key. */
  user: User;
}
