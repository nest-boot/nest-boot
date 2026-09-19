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
  /** 1–32 lowercase letters or digits, starting with a letter. Defaults to `sk`. */
  prefix?: string;
}
