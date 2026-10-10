/** Provider access token returned for a linked authentication account. */
export interface AuthAccessToken {
  /** OAuth access token. */
  accessToken: string;
  /** Access-token expiration time, or `null` when the provider omits it. */
  accessTokenExpiresAt: Date | null;
  /** OAuth scopes associated with the token. */
  scopes: string[];
  /** OpenID Connect ID token, or `null` when unavailable. */
  idToken: string | null;
}
