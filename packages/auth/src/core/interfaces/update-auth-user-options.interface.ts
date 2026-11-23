/** Fields accepted when updating the authenticated user. */
export interface UpdateAuthUserOptions {
  /** New display name. */
  name?: string;
  /** New avatar URL, or `null` to remove the current avatar. */
  image?: string | null;
}
