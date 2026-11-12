import type { User } from "../../core/entities/user.entity.js";
import type { Member } from "../../workspace/entities/member.entity.js";
import type { Workspace } from "../../workspace/entities/workspace.entity.js";
import type { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";

/** Successful authentication for a member-owned, workspace-scoped API key. */
export interface WorkspaceApiKeyValidation {
  /** Validated API-key entity. */
  apiKey: WorkspaceApiKey;
  /** Identifies the owner branch. */
  ownerType: "member";
  /** Member represented by the key. */
  member: Member;
  /** Login user when the owner is a user member. */
  user: User | null;
  /** Workspace represented by the key. */
  workspace: Workspace;
}
