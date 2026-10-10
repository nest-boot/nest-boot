/** OAuth client credentials supplied to a custom token request strategy. */
export interface AuthOAuthTokenRequestClientOptions {
  /** OAuth client identifier. */
  clientId?: string | string[];
  /** OAuth client secret. */
  clientSecret?: string;
}
