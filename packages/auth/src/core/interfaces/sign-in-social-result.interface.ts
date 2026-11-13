import type { AuthUserData } from "./auth-user-data.interface.js";

/** Result returned when starting a social or generic OAuth sign-in flow. */
export interface SignInSocialResult<User extends AuthUserData = AuthUserData> {
  /** Whether a browser client should navigate to {@link url}. */
  redirect: boolean;
  /** Provider authorization URL, or `null` for direct token sign-in. */
  url: string | null;
  /** Session token returned by direct token sign-in, or `null` for a redirect flow. */
  token: string | null;
  /** Authenticated user returned by direct token sign-in, or `null` for a redirect flow. */
  user: User | null;
}
