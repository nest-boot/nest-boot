import type { MemberApiKeyValidation } from "../interfaces/member-api-key-validation.interface.js";
import type { UserApiKeyValidation } from "../interfaces/user-api-key-validation.interface.js";

/** Successful API-key authentication result. */
export type ApiKeyValidation = UserApiKeyValidation | MemberApiKeyValidation;
