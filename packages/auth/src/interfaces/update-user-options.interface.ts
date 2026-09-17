/** Fields accepted when updating a user through `UserService`. */
export interface UpdateUserOptions {
  /** New email address. */
  email?: string;
  /** Whether the email address has been verified. */
  emailVerified?: boolean;
  /** New avatar URL, or `null` to remove it. */
  image?: string | null;
  /** New display name. */
  name?: string;
}
