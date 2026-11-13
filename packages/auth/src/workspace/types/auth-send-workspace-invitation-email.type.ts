import type { AuthWorkspaceInvitationEmailData } from "../interfaces/auth-workspace-invitation-email-data.interface.js";

/** Sends a workspace invitation message. */
export type AuthSendWorkspaceInvitationEmail = (
  /** WorkspaceInvitation, workspace, and inviter data. */
  data: AuthWorkspaceInvitationEmailData,
  /** Request that initiated the invitation, when supplied by the caller. */
  request?: Request,
) => Promise<void>;
