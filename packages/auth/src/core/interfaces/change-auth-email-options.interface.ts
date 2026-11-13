/** Options for changing the authenticated user's email address. */
export interface ChangeAuthEmailOptions {
  /** New email address. */
  newEmail: string;
  /** URL used after email verification completes. */
  callbackURL?: string;
}
