import type { AuthOAuthBasicTokenEndpointAuth } from "../interfaces/auth-oauth-basic-token-endpoint-auth.interface.js";
import type { AuthOAuthCustomTokenEndpointAuth } from "../interfaces/auth-oauth-custom-token-endpoint-auth.interface.js";
import type { AuthOAuthNoTokenEndpointAuth } from "../interfaces/auth-oauth-no-token-endpoint-auth.interface.js";
import type { AuthOAuthPostTokenEndpointAuth } from "../interfaces/auth-oauth-post-token-endpoint-auth.interface.js";
import type { AuthOAuthPrivateKeyJwtTokenEndpointAuth } from "../interfaces/auth-oauth-private-key-jwt-token-endpoint-auth.interface.js";

/** OAuth token-endpoint client authentication. */
export type AuthOAuthTokenEndpointAuth =
  | AuthOAuthNoTokenEndpointAuth
  | AuthOAuthBasicTokenEndpointAuth
  | AuthOAuthPostTokenEndpointAuth
  | AuthOAuthPrivateKeyJwtTokenEndpointAuth
  | AuthOAuthCustomTokenEndpointAuth;
