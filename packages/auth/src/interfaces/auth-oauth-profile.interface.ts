/** Raw user profile returned by a custom OAuth provider. */
export interface AuthOAuthProfile {
  /** OAuth provider identifier, when supplied. */
  id?: string | number | null;
  /** OpenID Connect subject, when supplied. */
  sub?: string | number | null;
  /** Provider-specific profile fields. */
  [key: string]: unknown;
}
