import type { User } from "../../core/entities/user.entity.js";
import type { OwnedApiKey } from "../entities/api-key.entity.js";

/** Successful authentication for a user-owned API key. */
export interface UserApiKeyValidation {
  /** Validated API-key entity. */
  apiKey: OwnedApiKey<"user">;
  /** Identifies the owner branch. */
  ownerType: "user";
  /** User represented by the key. */
  user: User;
}
