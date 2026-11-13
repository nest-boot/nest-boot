import type { AuthMaybePromise } from "../types/auth-maybe-promise.type.js";
import type { AuthOAuthClientAssertionContext } from "./auth-oauth-client-assertion-context.interface.js";

/** Token endpoint authenticated with a private-key JWT assertion. */
export interface AuthOAuthPrivateKeyJwtTokenEndpointAuth {
  /** Authentication method. */
  method: "private_key_jwt";
  /** Creates a signed client assertion for each token request. */
  getClientAssertion: (
    context: AuthOAuthClientAssertionContext,
  ) => AuthMaybePromise<string>;
}
