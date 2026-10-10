/** Local user attributes mapped from an OAuth provider profile. */
export interface AuthOAuthMappedUser {
  /** Provider identity is resolved separately and cannot replace the local ID. */
  id?: never;
  /** Display name. */
  name?: string;
  /** Email address. */
  email?: string | null;
  /** Profile image URL. */
  image?: string;
  /** Whether the email address is verified. */
  emailVerified?: boolean;
  /** Explicit application-owned profile fields. */
  [key: string]: unknown;
}
