/** A social or generic OAuth provider enabled by the authentication backend. */
export interface AuthSocialProvider {
  /** Stable provider identifier supplied to social authentication operations. */
  id: string;
  /** Human-readable provider name suitable for login and account-linking UI. */
  name: string;
}
