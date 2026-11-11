import type { AuthMaybePromise } from "../types/auth-maybe-promise.type.js";
import type { AuthOAuthTokenEndpointAuth } from "../types/auth-oauth-token-endpoint-auth.type.js";
import type { AuthOAuthMappedUser } from "./auth-oauth-mapped-user.interface.js";
import type { AuthOAuthProfile } from "./auth-oauth-profile.interface.js";
import type { AuthOAuthRefreshContext } from "./auth-oauth-refresh-context.interface.js";
import type { AuthOAuthTokens } from "./auth-oauth-tokens.interface.js";

/** One custom OAuth 2.0 or OpenID Connect provider. */
export interface AuthModuleOAuthProvider {
  /** Custom provider identifier. */
  id: string;
  /** Human-readable provider name. */
  name?: string;
  /** Resolves the provider's stable account subject. */
  accountSubject?: (context: {
    tokens: AuthOAuthTokens;
    profile: AuthOAuthProfile;
  }) => AuthMaybePromise<string | number>;
  /** OAuth or OpenID Connect discovery document URL. */
  discoveryUrl?: string;
  /** Requires discovery metadata sufficient for ID-token verification. */
  requireIdTokenVerification?: boolean;
  /** OAuth authorization endpoint URL. */
  authorizationUrl?: string;
  /** OAuth token endpoint URL. */
  tokenUrl?: string;
  /** OAuth user-info endpoint URL. */
  userInfoUrl?: string;
  /** OpenID Connect logout endpoint URL. */
  endSessionEndpoint?: string;
  /** Redirect URL after provider logout. */
  postLogoutRedirectURI?: string;
  /** Disables provider logout when the local session is cleared. */
  disableProviderLogout?: boolean;
  /** OAuth client identifier. */
  clientId: string;
  /** OAuth client secret. */
  clientSecret?: string;
  /** Token-endpoint authentication strategy. */
  tokenEndpointAuth?: AuthOAuthTokenEndpointAuth;
  /** OAuth scopes. */
  scopes?: string[];
  /** Custom callback URL. */
  redirectURI?: string;
  /** OAuth response type. */
  responseType?: string;
  /** OAuth response mode. */
  responseMode?: "query" | "form_post";
  /** Authorization prompt. */
  prompt?:
    | "none"
    | "login"
    | "create"
    | "consent"
    | "select_account"
    | "select_account consent"
    | "login consent";
  /** Enables PKCE. */
  pkce?: boolean;
  /** Authorization access type. */
  accessType?: string;
  /** Fallback access-token lifetime in seconds. */
  accessTokenExpiresIn?: number;
  /** Exchanges an authorization code for tokens. */
  getToken?: (data: {
    code: string;
    redirectURI: string;
    codeVerifier?: string;
    deviceId?: string;
  }) => Promise<AuthOAuthTokens>;
  /** Fetches the raw provider profile. */
  getUserInfo?: (tokens: AuthOAuthTokens) => Promise<AuthOAuthProfile | null>;
  /** Maps a raw provider profile to local user fields. */
  mapProfileToUser?: (
    profile: AuthOAuthProfile,
  ) => AuthMaybePromise<AuthOAuthMappedUser>;
  /** Additional authorization request parameters. */
  authorizationUrlParams?: Record<string, string>;
  /** Additional token request parameters. */
  tokenUrlParams?: Record<string, string>;
  /** Additional refresh-token request parameters. */
  refreshTokenParams?:
    | Record<string, string>
    | ((
        context?: AuthOAuthRefreshContext,
      ) => AuthMaybePromise<Record<string, string> | undefined>);
  /** Requires an explicit sign-up request for new identities. */
  disableImplicitSignUp?: boolean;
  /** Disables sign-up through this provider. */
  disableSignUp?: boolean;
  /** Legacy token-endpoint authentication strategy. */
  authentication?: "basic" | "post";
  /** Discovery request headers. */
  discoveryHeaders?: Record<string, string>;
  /** Authorization request headers. */
  authorizationHeaders?: Record<string, string>;
  /** Updates local user information from the provider. */
  overrideUserInfo?: boolean;
  /** Requires a verified email before creating a session. */
  requireEmailVerification?: boolean;
  /** Accepts provider-initiated OAuth flows. */
  allowIdpInitiated?: boolean;
  /** Disables OpenID Connect nonce binding. */
  disableIdTokenNonceBinding?: boolean;
}
