import type { AuthOAuthUserInfo } from "./auth-oauth-user-info.interface.js";

/** User information returned by a custom built-in social-provider hook. */
export interface AuthSocialProviderUserInfo {
  /** User attributes normalized for local persistence. */
  user: AuthOAuthUserInfo;
  /** Raw provider profile. */
  data: Record<string, unknown>;
}
