import type { AuthUserData } from "./auth-user-data.interface.js";

/** Data supplied when an email change requires confirmation. */
export interface AuthChangeEmailConfirmationData {
  /** User requesting the email change. */
  user: AuthUserData;
  /** Requested new email address. */
  newEmail: string;
  /** Complete confirmation URL. */
  url: string;
  /** Raw confirmation token. */
  token: string;
}
