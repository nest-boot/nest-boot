import type { AuthUser } from "./auth-user.interface.js";

/** Data supplied when an email verification message must be sent. */
export interface AuthEmailVerificationData {
  /** User whose email address must be verified. */
  user: AuthUser;
  /** Complete verification URL containing the token. */
  url: string;
  /** Raw verification token for custom message flows. */
  token: string;
}
