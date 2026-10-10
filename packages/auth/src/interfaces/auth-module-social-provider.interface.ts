import type { AuthMaybePromise } from "../types/auth-maybe-promise.type.js";
import type { AuthModuleSocialProviderId } from "../types/auth-module-social-provider-id.type.js";
import type { AuthOAuthClientAssertionContext } from "./auth-oauth-client-assertion-context.interface.js";
import type { AuthOAuthMappedUser } from "./auth-oauth-mapped-user.interface.js";
import type { AuthOAuthTokens } from "./auth-oauth-tokens.interface.js";
import type { AuthSocialProviderUserInfo } from "./auth-social-provider-user-info.interface.js";

/** One built-in social provider registered through AuthModule. */
export interface AuthModuleSocialProvider {
  /** Built-in provider identifier. */
  id: AuthModuleSocialProviderId;
  /** OAuth client identifier. */
  clientId?: string | string[];
  /** OAuth client secret. */
  clientSecret?: string;
  /** Provider scopes. */
  scope?: string[];
  /** Removes the provider's default scopes. */
  disableDefaultScope?: boolean;
  /** Custom callback URL. */
  redirectURI?: string;
  /** Custom authorization endpoint URL. */
  authorizationEndpoint?: string;
  /** Client key used by providers such as TikTok. */
  clientKey?: string;
  /** Disables client-submitted ID-token sign-in. */
  disableIdTokenSignIn?: boolean;
  /** Verifies a client-submitted ID token. */
  verifyIdToken?: (
    token: string,
    nonce?: string,
    context?: unknown,
  ) => Promise<boolean>;
  /** Fetches provider user information. */
  getUserInfo?: (
    tokens: AuthOAuthTokens,
  ) => Promise<AuthSocialProviderUserInfo | null>;
  /** Refreshes provider tokens. */
  refreshAccessToken?: (refreshToken: string) => Promise<AuthOAuthTokens>;
  /** Maps a raw provider profile to local user fields. */
  mapProfileToUser?: (
    profile: Record<string, unknown>,
  ) => AuthMaybePromise<AuthOAuthMappedUser>;
  /** Requires an explicit sign-up request for new identities. */
  disableImplicitSignUp?: boolean;
  /** Disables sign-up through this provider. */
  disableSignUp?: boolean;
  /** Authorization prompt. */
  prompt?:
    | "select_account"
    | "consent"
    | "login"
    | "none"
    | "select_account consent";
  /** Authorization response mode. */
  responseMode?: "query" | "form_post";
  /** Updates local user information from the provider during sign-in. */
  overrideUserInfoOnSignIn?: boolean;
  /** Requires a verified email before creating a session. */
  requireEmailVerification?: boolean;
  /** Explicitly enables or disables this provider. */
  enabled?: boolean;
  /** Apple application bundle identifier. */
  appBundleIdentifier?: string;
  /** Apple token audience. */
  audience?: string | string[];
  /** Cognito hosted UI domain. */
  domain?: string;
  /** Cognito AWS region. */
  region?: string;
  /** Cognito user pool identifier. */
  userPoolId?: string;
  /** Whether Cognito client authentication requires a secret. */
  requireClientSecret?: boolean;
  /** Cognito identity-provider hint. */
  identityProvider?: string;
  /** Discord application permissions bit field. */
  permissions?: number;
  /** Provider-specific access type. */
  accessType?: "offline" | "online" | "legacy";
  /** Facebook user profile fields. */
  fields?: string[];
  /** Facebook OAuth configuration identifier. */
  configId?: string;
  /** GitLab or Paybin issuer URL. */
  issuer?: string;
  /** Google authorization display mode. */
  display?: "page" | "popup" | "touch" | "wap";
  /** Required Google Workspace hosted domain. */
  hd?: string;
  /** Enables Google's incremental authorization. */
  includeGrantedScopes?: boolean;
  /** Microsoft tenant identifier. */
  tenantId?: string;
  /** Microsoft authentication authority URL. */
  authority?: string;
  /** Creates a Microsoft private-key JWT client assertion. */
  clientAssertion?: (
    context: AuthOAuthClientAssertionContext,
  ) => AuthMaybePromise<string>;
  /** Microsoft profile photo size. */
  profilePhotoSize?: 48 | 64 | 96 | 120 | 240 | 360 | 432 | 504 | 648;
  /** Disables loading the Microsoft profile photo. */
  disableProfilePhoto?: boolean;
  /** PayPal or Salesforce environment. */
  environment?: "sandbox" | "live" | "production";
  /** Requests a PayPal shipping address. */
  requestShippingAddress?: boolean;
  /** Reddit access-token duration. */
  duration?: string;
  /** Salesforce login URL. */
  loginUrl?: string;
  /** Twitch claims. */
  claims?: string[];
  /** VK color scheme. */
  scheme?: "light" | "dark";
  /** WeChat platform type. */
  platformType?: "WebsiteApp";
  /** WeChat authorization page language. */
  lang?: "cn" | "en";
  /** Enables PKCE for providers that make it configurable. */
  pkce?: boolean;
  /** Cloudflare token-endpoint authentication method. */
  tokenEndpointAuthMethod?:
    | "client_secret_basic"
    | "client_secret_post"
    | "none";
}
