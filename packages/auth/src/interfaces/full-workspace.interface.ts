import type { Invitation } from "../entities/invitation.entity.js";
import type { Member } from "../entities/member.entity.js";
import type { Workspace } from "../entities/workspace.entity.js";

/** Workspace details with members and invitation lifecycle records. */
export interface FullWorkspace {
  /** Workspace entity. */
  workspace: Workspace;
  /** Active and disabled members. */
  members: Member[];
  /** Invitation lifecycle records. */
  invitations: Invitation[];
}
