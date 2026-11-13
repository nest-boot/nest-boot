import type { AuthUser } from "./auth-user.interface.js";

/** Data supplied when account deletion requires email verification. */
export interface AuthDeleteAccountVerificationData {
  /** User requesting account deletion. */
  user: AuthUser;
  /** Complete account-deletion URL. */
  url: string;
  /** Raw account-deletion token. */
  token: string;
}
