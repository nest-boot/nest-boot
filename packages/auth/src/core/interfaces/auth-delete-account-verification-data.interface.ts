import type { AuthUserData } from "./auth-user-data.interface.js";

/** Data supplied when account deletion requires email verification. */
export interface AuthDeleteAccountVerificationData {
  /** User requesting account deletion. */
  user: AuthUserData;
  /** Complete account-deletion URL. */
  url: string;
  /** Raw account-deletion token. */
  token: string;
}
