import type { AuthResetPasswordData } from "../interfaces/auth-reset-password-data.interface.js";

/** Sends a password reset message. */
export type AuthSendResetPassword = (
  /** Password reset recipient and URL data. */
  data: AuthResetPasswordData,
  /** Request that initiated the password reset, when available. */
  request?: Request,
) => Promise<void>;
