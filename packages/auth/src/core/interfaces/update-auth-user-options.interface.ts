/** Fields accepted when updating the authenticated user. */
export interface UpdateAuthUserOptions {
  /** New display name. */
  name?: string;
  /** New username; omit it to preserve the current handle. */
  username?: string;
  /** New avatar URL, or `null` to remove the current avatar. */
  image?: string | null;
}
