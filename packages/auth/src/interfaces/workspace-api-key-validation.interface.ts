import type { ApiKey } from "../entities/api-key.entity.js";
import type { Workspace } from "../entities/workspace.entity.js";

/** Successful authentication for a workspace-owned API key. */
export interface WorkspaceApiKeyValidation {
  /** Validated API-key entity. */
  apiKey: ApiKey;
  /** Identifies the owner branch. */
  ownerType: "workspace";
  /** Workspace represented by the key. */
  workspace: Workspace;
}
