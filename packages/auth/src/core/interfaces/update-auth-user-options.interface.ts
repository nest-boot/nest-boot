/** Fields accepted when updating the authenticated user. */
export interface UpdateAuthUserOptions {
  /** New display name. */
  name?: string;
  /** New username, or null to remove the username. */
  username?: string | null;
  /** New avatar URL, or `null` to remove the current avatar. */
  image?: string | null;
}
