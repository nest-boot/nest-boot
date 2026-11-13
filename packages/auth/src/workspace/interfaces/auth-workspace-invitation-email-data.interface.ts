import type { Workspace } from "../entities/workspace.entity.js";
import type { WorkspaceInvitation } from "../entities/workspace-invitation.entity.js";
import type { AuthWorkspaceInvitationEmailInviter } from "../types/auth-workspace-invitation-email-inviter.type.js";

/** Data supplied when a workspace invitation message must be sent. */
export interface AuthWorkspaceInvitationEmailData {
  /** WorkspaceInvitation identifier used by the application to construct an accept URL. */
  id: string;
  /** Roles granted when the recipient accepts the invitation. */
  roles: string[];
  /** Normalized recipient email address. */
  email: string;
  /** Workspace the recipient is invited to join. */
  workspace: Workspace;
  /** Persisted invitation lifecycle record. */
  invitation: WorkspaceInvitation;
  /** Active workspace member that issued the invitation and its user. */
  inviter: AuthWorkspaceInvitationEmailInviter;
}
