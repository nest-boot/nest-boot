/** Public user data returned by authentication operations. */
export interface AuthUser {
  /** Unique user identifier. */
  id: string;
  /** User display name. */
  name: string;
  /** User email address. */
  email: string;
  /** Whether the email address has been verified. */
  emailVerified: boolean;
  /** User avatar URL, or `null` when no avatar is configured. */
  image?: string | null;
  /** Timestamp when the user was created. */
  createdAt: Date;
  /** Timestamp when the user was last updated. */
  updatedAt: Date;
  /** Application-defined user fields. */
  [field: string]: unknown;
}
