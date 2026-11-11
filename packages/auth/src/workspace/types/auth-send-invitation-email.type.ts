import type { AuthInvitationEmailData } from "../interfaces/auth-invitation-email-data.interface.js";

/** Sends a workspace invitation message. */
export type AuthSendInvitationEmail = (
  /** Invitation, workspace, and inviter data. */
  data: AuthInvitationEmailData,
  /** Request that initiated the invitation, when supplied by the caller. */
  request?: Request,
) => Promise<void>;
