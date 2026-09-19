import type { AuthUser } from "./auth-user.interface.js";

/** Data supplied when a password reset message must be sent. */
export interface AuthResetPasswordData {
  /** User whose password must be reset. */
  user: AuthUser;
  /** Complete password reset URL containing the token. */
  url: string;
  /** Raw password reset token for custom message flows. */
  token: string;
}
