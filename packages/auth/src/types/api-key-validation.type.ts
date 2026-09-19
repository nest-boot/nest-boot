import type { UserApiKeyValidation } from "../interfaces/user-api-key-validation.interface.js";
import type { WorkspaceApiKeyValidation } from "../interfaces/workspace-api-key-validation.interface.js";

/** Successful API-key authentication result. */
export type ApiKeyValidation = UserApiKeyValidation | WorkspaceApiKeyValidation;
