/** Context supplied when an OAuth provider refreshes tokens. */
export interface AuthOAuthRefreshContext {
  /** Request headers, when available. */
  headers?: Headers;
  /** Request that initiated the refresh, when available. */
  request?: Request;
}
