import type { Invitation } from "../../entities/invitation.entity.js";
import type { Workspace } from "../../entities/workspace.entity.js";
import type { AuthInvitationEmailInviter } from "./auth-invitation-email-inviter.type.js";

/** Data supplied when a workspace invitation message must be sent. */
export interface AuthInvitationEmailData {
  /** Invitation identifier used by the application to construct an accept URL. */
  id: string;
  /** Roles granted when the recipient accepts the invitation. */
  roles: string[];
  /** Normalized recipient email address. */
  email: string;
  /** Workspace the recipient is invited to join. */
  workspace: Workspace;
  /** Persisted invitation lifecycle record. */
  invitation: Invitation;
  /** Active workspace member that issued the invitation and its user. */
  inviter: AuthInvitationEmailInviter;
}
