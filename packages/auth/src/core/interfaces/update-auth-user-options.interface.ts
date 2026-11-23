/** Fields accepted when updating the authenticated user. */
export interface UpdateAuthUserOptions {
  /** New display name. */
  name?: string;
  /** New username; omission preserves it and null clears it. */
  username?: string | null;
  /** New avatar URL, or `null` to remove the current avatar. */
  image?: string | null;
}
