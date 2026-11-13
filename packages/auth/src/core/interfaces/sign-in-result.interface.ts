import type { AuthUserData } from "./auth-user-data.interface.js";

/** Result returned after signing in with email and password. */
export interface SignInResult<User extends AuthUserData = AuthUserData> {
  /** Whether the caller should redirect to {@link url}. */
  redirect: boolean;
  /** Created session token. */
  token: string;
  /** Redirect target, or `null` when no redirect was requested. */
  url: string | null;
  /** Authenticated user. */
  user: User;
}
