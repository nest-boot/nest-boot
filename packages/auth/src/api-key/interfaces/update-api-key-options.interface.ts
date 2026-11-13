/** Input accepted when updating an API key. */
export interface UpdateApiKeyOptions {
  /** Optional expiration timestamp; `null` removes expiration. */
  expiresAt?: Date | null;
  /** API-key display name. */
  name?: string;
  /**
   * Replacement permission list. Omission preserves the stored permissions;
   * `null` clears them.
   */
  permissions?: string[] | null;
}
