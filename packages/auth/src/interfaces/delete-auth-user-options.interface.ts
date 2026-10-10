/** Options for deleting the authenticated user. */
export interface DeleteAuthUserOptions {
  /** URL used after account-deletion verification completes. */
  callbackURL?: string;
  /** Current password when the session is not fresh enough. */
  password?: string;
  /** Account-deletion verification token. */
  token?: string;
}
