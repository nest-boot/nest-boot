/** Context supplied to private-key JWT client authentication. */
export interface AuthOAuthClientAssertionContext {
  /** OAuth client identifier. */
  clientId: string;
  /** Token endpoint URL. */
  tokenEndpoint: string;
  /** OAuth grant being authenticated. */
  grantType: "authorization_code" | "refresh_token" | "client_credentials";
}
