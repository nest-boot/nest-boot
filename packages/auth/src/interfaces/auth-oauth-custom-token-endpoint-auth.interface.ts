import type { AuthOAuthTokenRequestContext } from "./auth-oauth-token-request-context.interface.js";

/** Token endpoint authenticated by an application-defined request hook. */
export interface AuthOAuthCustomTokenEndpointAuth {
  /** Authentication method. */
  method: "custom";
  /** Mutates the token request after standard grant fields are populated. */
  customizeRequest: (
    context: AuthOAuthTokenRequestContext,
  ) => void | Promise<void>;
}
