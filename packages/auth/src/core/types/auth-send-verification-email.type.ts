import type { AuthEmailVerificationData } from "../interfaces/auth-email-verification-data.interface.js";

/** Sends an email verification message. */
export type AuthSendVerificationEmail = (
  /** Verification recipient and URL data. */
  data: AuthEmailVerificationData,
  /** Request that initiated verification, when available. */
  request?: Request,
) => Promise<void>;
