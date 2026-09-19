/** OAuth tokens returned by a custom authentication provider. */
export interface AuthOAuthTokens {
  /** Token type, commonly `Bearer`. */
  tokenType?: string;
  /** OAuth access token. */
  accessToken?: string;
  /** OAuth refresh token. */
  refreshToken?: string;
  /** Access-token expiry time. */
  accessTokenExpiresAt?: Date;
  /** Refresh-token expiry time. */
  refreshTokenExpiresAt?: Date;
  /** Scopes granted by the provider. */
  scopes?: string[];
  /** OpenID Connect ID token. */
  idToken?: string;
  /** Provider-specific token response fields. */
  raw?: Record<string, unknown>;
}
