import type { AuthOAuthClientAssertionContext } from "./auth-oauth-client-assertion-context.interface.js";
import type { AuthOAuthTokenRequestClientOptions } from "./auth-oauth-token-request-client-options.interface.js";

/** Mutable token request supplied to a custom authentication strategy. */
export interface AuthOAuthTokenRequestContext {
  /** Token request form body. */
  body: URLSearchParams;
  /** Token request headers. */
  headers: Record<string, string>;
  /** OAuth client credentials. */
  options: AuthOAuthTokenRequestClientOptions;
  /** Token endpoint URL. */
  tokenEndpoint: string;
  /** OAuth grant being authenticated. */
  grantType: AuthOAuthClientAssertionContext["grantType"];
}
