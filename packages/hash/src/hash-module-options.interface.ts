/**
 * Configuration options for the HashModule.
 */
export interface HashModuleOptions {
  /**
   * The secret key used for hashing.
   * If not provided, falls back to HASH_SECRET or APP_SECRET environment variables.
   */
  secret?: string;
}
