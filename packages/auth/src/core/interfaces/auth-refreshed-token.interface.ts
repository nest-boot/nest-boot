/** Refreshed provider credentials for a linked authentication account. */
export interface AuthRefreshedToken {
  /** Refreshed OAuth access token, or `null` when the provider omits it. */
  accessToken: string | null;
  /** OAuth refresh token. */
  refreshToken: string;
  /** Access-token expiration time, or `null` when unavailable. */
  accessTokenExpiresAt: Date | null;
  /** Refresh-token expiration time, or `null` when unavailable. */
  refreshTokenExpiresAt: Date | null;
  /** Space-delimited provider scope, or `null` when unavailable. */
  scope: string | null;
  /** OpenID Connect ID token, or `null` when unavailable. */
  idToken: string | null;
  /** Authentication provider identifier. */
  providerId: string;
  /** Better Auth account record identifier. */
  accountId: string;
}
