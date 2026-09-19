import type { UserApiKey } from "../entities/user-api-key.entity.js";
import type { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";

/** A user-owned or workspace-owned API credential. */
export type ApiKey = UserApiKey | WorkspaceApiKey;
