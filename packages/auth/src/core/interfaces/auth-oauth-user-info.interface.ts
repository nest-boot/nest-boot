/** User information normalized by a built-in social provider. */
export interface AuthOAuthUserInfo {
  /** Provider identity is carried in the raw profile. */
  id?: never;
  /** Display name. */
  name?: string;
  /** Email address. */
  email?: string | null;
  /** Profile image URL. */
  image?: string;
  /** Whether the email address is verified. */
  emailVerified: boolean;
}
