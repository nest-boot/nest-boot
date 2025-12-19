/**
 * Configuration options for the CryptModule.
 */
export interface CryptModuleOptions {
  /**
   * The secret key used for encryption and decryption.
   * If not provided, falls back to CRYPT_SECRET or APP_SECRET environment variables.
   */
  secret?: string;
}
