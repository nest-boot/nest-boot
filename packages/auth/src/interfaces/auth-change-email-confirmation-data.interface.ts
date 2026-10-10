import type { AuthUser } from "./auth-user.interface.js";

/** Data supplied when an email change requires confirmation. */
export interface AuthChangeEmailConfirmationData {
  /** User requesting the email change. */
  user: AuthUser;
  /** Requested new email address. */
  newEmail: string;
  /** Complete confirmation URL. */
  url: string;
  /** Raw confirmation token. */
  token: string;
}
