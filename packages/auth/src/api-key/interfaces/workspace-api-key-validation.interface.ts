import type { User } from "../../core/entities/user.entity.js";
import type { Workspace } from "../../workspace/entities/workspace.entity.js";
import type { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import type { OwnedApiKey } from "../entities/api-key.entity.js";

/** Successful authentication for a member-owned, workspace-scoped API key. */
export interface WorkspaceApiKeyValidation {
  /** Validated API-key entity. */
  apiKey: OwnedApiKey<"workspace_member">;
  /** Identifies the owner branch. */
  ownerType: "workspace_member";
  /** WorkspaceMember represented by the key. */
  member: WorkspaceMember;
  /** Login user when the owner is a user member. */
  user: User | null;
  /** Workspace represented by the key. */
  workspace: Workspace;
}
