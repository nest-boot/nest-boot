import type { Workspace } from "../entities/workspace.entity.js";
import type { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";

/** Successful authentication for a workspace-owned API key. */
export interface WorkspaceApiKeyValidation {
  /** Validated API-key entity. */
  apiKey: WorkspaceApiKey;
  /** Identifies the owner branch. */
  ownerType: "workspace";
  /** Workspace represented by the key. */
  workspace: Workspace;
}
