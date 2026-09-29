/** Input accepted when creating an API key. */
export interface CreateApiKeyOptions {
  /** API-key display name. */
  name: string;
  /** Optional expiration timestamp. */
  expiresAt?: Date | null;
  /**
   * Operations granted to the key. Omission uses the configured defaults;
   * `null` or an empty list creates a key without permissions.
   */
  permissions?: string[] | null;
  /** 1–32 lowercase letters, digits, underscores, or hyphens, starting with a letter. Overrides the owner scope’s default prefix; separators are included verbatim. */
  prefix?: string;
}
