import type { EntityClass } from "@mikro-orm/core";
import type { Type } from "@nestjs/common";
import type { RouteInfo } from "@nestjs/common/interfaces/middleware/middleware-configuration.interface.js";

import type {
  BaseAccount,
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseVerification,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
import type { AuthUser } from "./interfaces/auth-service.interface.js";
import type { AuthModuleRoles } from "./types/auth-module-roles.type.js";
import type { BuildUserAbilityCallback } from "./types/build-user-ability-callback.type.js";
import type { BuildWorkspaceAbilityCallback } from "./types/build-workspace-ability-callback.type.js";

/** A value returned synchronously or asynchronously by an AuthModule callback. */
export type AuthMaybePromise<T> = T | Promise<T>;

/** Data supplied when an email verification message must be sent. */
export interface AuthEmailVerificationData {
  /** User whose email address must be verified. */
  user: AuthUser;
  /** Complete verification URL containing the token. */
  url: string;
  /** Raw verification token for custom message flows. */
  token: string;
}

/** Sends an email verification message. */
export type AuthSendVerificationEmail = (
  /** Verification recipient and URL data. */
  data: AuthEmailVerificationData,
  /** Request that initiated verification, when available. */
  request?: Request,
) => Promise<void>;

/** Data supplied when a password reset message must be sent. */
export interface AuthResetPasswordData {
  /** User whose password must be reset. */
  user: AuthUser;
  /** Complete password reset URL containing the token. */
  url: string;
  /** Raw password reset token for custom message flows. */
  token: string;
}

/** Sends a password reset message. */
export type AuthSendResetPassword = (
  /** Password reset recipient and URL data. */
  data: AuthResetPasswordData,
  /** Request that initiated the password reset, when available. */
  request?: Request,
) => Promise<void>;

/** Workspace member and user that issued an invitation. */
export type AuthWorkspaceInvitationEmailInviter = Omit<
  BaseWorkspaceMember,
  "user"
> & {
  /** Authenticated user represented by the workspace membership. */
  user: BaseUser;
};

/** Data supplied when a workspace invitation message must be sent. */
export interface AuthWorkspaceInvitationEmailData {
  /** Invitation identifier used by the application to construct an accept URL. */
  id: string;
  /** Roles granted when the recipient accepts the invitation. */
  roles: string[];
  /** Normalized recipient email address. */
  email: string;
  /** Workspace the recipient is invited to join. */
  workspace: BaseWorkspace;
  /** Persisted invitation lifecycle record. */
  invitation: BaseWorkspaceInvitation;
  /** Active workspace member that issued the invitation and its user. */
  inviter: AuthWorkspaceInvitationEmailInviter;
}

/** Sends a workspace invitation message. */
export type AuthSendWorkspaceInvitationEmail = (
  /** Invitation, workspace, and inviter data. */
  data: AuthWorkspaceInvitationEmailData,
  /** Request that initiated the invitation, when supplied by the caller. */
  request?: Request,
) => Promise<void>;

/** Password hashing callbacks used by email authentication. */
export interface AuthModulePasswordOptions {
  /** Hashes a plain-text password. Defaults to the injected HashService. */
  hash?: (password: string) => Promise<string>;
  /** Verifies a plain-text password against its stored hash. */
  verify?: (data: { hash: string; password: string }) => Promise<boolean>;
}

/** Email and password authentication options owned by AuthModule. */
export interface AuthModuleEmailAndPasswordOptions {
  /** Whether email and password authentication is enabled. Defaults to true. */
  enabled?: boolean;
  /** Whether new email/password registrations are disabled. */
  disableSignUp?: boolean;
  /** Whether users must verify their email before signing in. Defaults to true. */
  requireEmailVerification?: boolean;
  /** Maximum accepted password length. Defaults to 128. */
  maxPasswordLength?: number;
  /** Minimum accepted password length. Defaults to 8. */
  minPasswordLength?: number;
  /** Custom password reset sender. Defaults to the injected Mailer implementation. */
  sendResetPassword?: AuthSendResetPassword;
  /** Password-reset token lifetime in seconds. */
  resetPasswordTokenExpiresIn?: number;
  /** Runs after a password has been reset successfully. */
  onPasswordReset?: (
    data: { user: AuthUser },
    request?: Request,
  ) => Promise<void>;
  /** Password hashing and verification callbacks. */
  password?: AuthModulePasswordOptions;
  /** Whether a successful registration creates a session automatically. */
  autoSignIn?: boolean;
  /** Whether password reset revokes every existing session. */
  revokeSessionsOnPasswordReset?: boolean;
  /** Runs when registration is attempted for an existing email address. */
  onExistingUserSignUp?: (
    data: { user: AuthUser },
    request?: Request,
  ) => Promise<void>;
}

/** Email verification options owned by AuthModule. */
export interface AuthModuleEmailVerificationOptions {
  /** Custom verification sender. Defaults to the injected Mailer implementation. */
  sendVerificationEmail?: AuthSendVerificationEmail;
  /** Whether registration sends a verification email automatically. */
  sendOnSignUp?: boolean;
  /** Whether sign-in sends a verification email for an unverified address. */
  sendOnSignIn?: boolean;
  /** Whether successful verification creates a session automatically. */
  autoSignInAfterVerification?: boolean;
  /** Verification-token lifetime in seconds. */
  expiresIn?: number;
  /** Runs immediately before an email address is verified. */
  beforeEmailVerification?: (
    user: AuthUser,
    request?: Request,
  ) => Promise<void>;
  /** Runs after an email address has been verified. */
  afterEmailVerification?: (user: AuthUser, request?: Request) => Promise<void>;
}

/** Data supplied when an email change requires confirmation. */
export interface AuthChangeEmailConfirmationData {
  /** User requesting the email change. */
  user: AuthUser;
  /** Requested new email address. */
  newEmail: string;
  /** Complete confirmation URL. */
  url: string;
  /** Raw confirmation token. */
  token: string;
}

/** Email-change lifecycle options. */
export interface AuthModuleChangeEmailOptions {
  /** Whether changing email addresses is enabled. */
  enabled: boolean;
  /** Sends confirmation to the current email address. */
  sendChangeEmailConfirmation?: (
    data: AuthChangeEmailConfirmationData,
    request?: Request,
  ) => Promise<void>;
  /** Allows an unverified user to replace its email without verification. */
  updateEmailWithoutVerification?: boolean;
}

/** Data supplied when account deletion requires email verification. */
export interface AuthDeleteAccountVerificationData {
  /** User requesting account deletion. */
  user: AuthUser;
  /** Complete account-deletion URL. */
  url: string;
  /** Raw account-deletion token. */
  token: string;
}

/** User-deletion lifecycle options. */
export interface AuthModuleDeleteUserOptions {
  /** Whether self-service user deletion is enabled. */
  enabled?: boolean;
  /** Sends an account-deletion verification message. */
  sendDeleteAccountVerification?: (
    data: AuthDeleteAccountVerificationData,
    request?: Request,
  ) => Promise<void>;
  /** Runs before coordinated user deletion. */
  beforeDelete?: (user: AuthUser, request?: Request) => Promise<void>;
  /** Runs after coordinated user deletion. */
  afterDelete?: (user: AuthUser, request?: Request) => Promise<void>;
  /** Account-deletion token lifetime in seconds. */
  deleteTokenExpiresIn?: number;
}

/** Workspace lifecycle options owned by AuthModule. */
export interface AuthModuleWorkspaceOptions<
  Permission extends string = string,
  Workspace extends BaseWorkspace = BaseWorkspace,
> {
  /** Role assigned to members and invitations when none is supplied. Defaults to `member`. */
  defaultRole?: string;
  /** Role assigned to a workspace creator. Defaults to `owner`. */
  creatorRole?: string;
  /** Workspace permission catalog. Defaults to `DEFAULT_WORKSPACE_PERMISSIONS`. */
  permissions?: readonly Permission[];
  /** Named workspace roles and their permissions. Defaults to `DEFAULT_WORKSPACE_ROLES`. */
  roles?: AuthModuleRoles<NoInfer<Permission>>;
  /** Builds the workspace-scoped CASL ability from resolved member permissions and the selected workspace. */
  buildAbility?: BuildWorkspaceAbilityCallback<Permission, Workspace>;
  /** Sends the invitation link through an application-defined delivery flow. */
  sendInvitationEmail?: AuthSendWorkspaceInvitationEmail;
}

/** User lifecycle and authorization options owned by AuthModule. */
export interface AuthModuleUserOptions<
  Permission extends string = string,
  User extends BaseUser = BaseUser,
> {
  /** Role assigned to users when none is supplied. Defaults to `user`. */
  defaultRole?: string;
  /** Roles classified as administrators. Defaults to `admin`. */
  adminRoles?: readonly string[];
  /** User permission catalog. Defaults to `DEFAULT_USER_PERMISSIONS`. */
  permissions?: readonly Permission[];
  /** Named user roles and their permissions. Defaults to `DEFAULT_USER_ROLES`. */
  roles?: AuthModuleRoles<NoInfer<Permission>>;
  /** Builds the user-scoped CASL ability from resolved permissions and the authenticated user. */
  buildAbility?: BuildUserAbilityCallback<Permission, User>;
  /** Email-change lifecycle configuration. */
  changeEmail?: AuthModuleChangeEmailOptions;
  /** User-deletion lifecycle configuration. */
  deleteUser?: AuthModuleDeleteUserOptions;
}

/** Account-linking behavior for OAuth identities. */
export interface AuthModuleAccountLinkingOptions {
  /** Whether account linking is enabled. */
  enabled?: boolean;
  /** Requires users to link identities explicitly. */
  disableImplicitLinking?: boolean;
  /** Requires a verified local email before implicit linking. */
  requireLocalEmailVerified?: boolean;
  /** Providers trusted for account linking. */
  trustedProviders?:
    | string[]
    | ((request?: Request) => AuthMaybePromise<string[]>);
  /** Allows linking a provider identity with a different email address. */
  allowDifferentEmails?: boolean;
  /** Allows unlinking the final authentication account. */
  allowUnlinkingAll?: boolean;
  /** Copies provider profile information to the local user when linking. */
  updateUserInfoOnLink?: boolean;
}

/** OAuth account persistence and state-validation options. */
export interface AuthModuleAccountOptions {
  /** Refreshes stored provider account data during sign-in. */
  updateAccountOnSignIn?: boolean;
  /** Account-linking behavior. */
  accountLinking?: AuthModuleAccountLinkingOptions;
  /** Encrypts persisted OAuth token values. */
  encryptOAuthTokens?: boolean;
  /** Disables OAuth state Cookie validation. Use only in exceptional deployments. */
  skipStateCookieCheck?: boolean;
  /** Persistence strategy for OAuth state. */
  storeStateStrategy?: "cookie" | "database";
  /** Stores provider account data in an encrypted Cookie. */
  storeAccountCookie?: boolean;
}

/** Stateless session Cookie cache refresh options. */
export interface AuthModuleSessionCookieCacheRefreshOptions {
  /** Interval in seconds after which the cached session is refreshed. */
  updateAge?: number;
}

/** Session Cookie cache options. */
export interface AuthModuleSessionCookieCacheOptions {
  /** Whether session Cookie caching is enabled. */
  enabled?: boolean;
  /** Cached session lifetime in seconds. */
  maxAge?: number;
  /** Cookie cache encoding strategy. */
  strategy?: "compact" | "jwe" | "jwt";
  /** Enables or configures stateless cache refresh. */
  refreshCache?: boolean | AuthModuleSessionCookieCacheRefreshOptions;
  /** Cache version used to invalidate previously issued values. */
  version?:
    | string
    | ((
        session: Record<string, unknown>,
        user: Record<string, unknown>,
      ) => string)
    | ((
        session: Record<string, unknown>,
        user: Record<string, unknown>,
      ) => Promise<string>);
}

/** Session lifecycle and Cookie cache options. */
export interface AuthModuleSessionOptions {
  /** Session lifetime in seconds. */
  expiresIn?: number;
  /** Session refresh interval in seconds. */
  updateAge?: number;
  /** Disables automatic session refresh. */
  disableSessionRefresh?: boolean;
  /** Defers session refresh writes to POST requests. */
  deferSessionRefresh?: boolean;
  /** Session Cookie cache configuration. */
  cookieCache?: AuthModuleSessionCookieCacheOptions;
  /** Maximum session age considered fresh for sensitive operations. */
  freshAge?: number;
}

/** Options for configuring auth middleware route registration. */
export interface AuthModuleMiddlewareOptions {
  /** Whether to register the auth middleware (defaults to true). */
  register?: boolean;
  /** Routes to include in auth middleware processing. */
  includeRoutes?: (string | RouteInfo | Type)[];
  /** Routes to exclude from auth middleware processing. */
  excludeRoutes?: (string | RouteInfo)[];
}

/** API-key permission defaults and grant limits owned by AuthModule. */
export interface AuthModuleApiKeyOptions<Permission extends string = string> {
  /**
   * Permissions assigned when key creation omits `permissions`.
   * Defaults to an empty list.
   */
  defaultPermissions?: readonly Permission[];
  /**
   * Permissions that may be granted to any API key.
   * Defaults to the combined user and workspace permission catalogs.
   */
  allowedPermissions?: readonly Permission[];
}

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

/** Local user attributes mapped from an OAuth provider profile. */
export interface AuthOAuthMappedUser {
  /** Provider identity is resolved separately and cannot replace the local ID. */
  id?: never;
  /** Display name. */
  name?: string;
  /** Email address. */
  email?: string | null;
  /** Profile image URL. */
  image?: string;
  /** Whether the email address is verified. */
  emailVerified?: boolean;
  /** Explicit application-owned profile fields. */
  [key: string]: unknown;
}

/** User information normalized by a built-in social provider. */
export interface AuthOAuthUserInfo {
  /** Provider identity is carried in the raw profile. */
  id?: never;
  /** Display name. */
  name?: string;
  /** Email address. */
  email?: string | null;
  /** Profile image URL. */
  image?: string;
  /** Whether the email address is verified. */
  emailVerified: boolean;
}

/** Raw user profile returned by a custom OAuth provider. */
export interface AuthOAuthProfile {
  /** OAuth provider identifier, when supplied. */
  id?: string | number | null;
  /** OpenID Connect subject, when supplied. */
  sub?: string | number | null;
  /** Provider-specific profile fields. */
  [key: string]: unknown;
}

/** Context supplied when an OAuth provider refreshes tokens. */
export interface AuthOAuthRefreshContext {
  /** Request headers, when available. */
  headers?: Headers;
  /** Request that initiated the refresh, when available. */
  request?: Request;
}

/** Context supplied to private-key JWT client authentication. */
export interface AuthOAuthClientAssertionContext {
  /** OAuth client identifier. */
  clientId: string;
  /** Token endpoint URL. */
  tokenEndpoint: string;
  /** OAuth grant being authenticated. */
  grantType: "authorization_code" | "refresh_token" | "client_credentials";
}

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

/** OAuth client credentials supplied to a custom token request strategy. */
export interface AuthOAuthTokenRequestClientOptions {
  /** OAuth client identifier. */
  clientId?: string | string[];
  /** OAuth client secret. */
  clientSecret?: string;
}

/** Token endpoint that does not authenticate the OAuth client. */
export interface AuthOAuthNoTokenEndpointAuth {
  /** Authentication method. */
  method: "none";
}

/** Token endpoint authenticated with HTTP Basic client credentials. */
export interface AuthOAuthBasicTokenEndpointAuth {
  /** Authentication method. */
  method: "client_secret_basic";
}

/** Token endpoint authenticated with client credentials in the request body. */
export interface AuthOAuthPostTokenEndpointAuth {
  /** Authentication method. */
  method: "client_secret_post";
}

/** Token endpoint authenticated with a private-key JWT assertion. */
export interface AuthOAuthPrivateKeyJwtTokenEndpointAuth {
  /** Authentication method. */
  method: "private_key_jwt";
  /** Creates a signed client assertion for each token request. */
  getClientAssertion: (
    context: AuthOAuthClientAssertionContext,
  ) => AuthMaybePromise<string>;
}

/** Token endpoint authenticated by an application-defined request hook. */
export interface AuthOAuthCustomTokenEndpointAuth {
  /** Authentication method. */
  method: "custom";
  /** Mutates the token request after standard grant fields are populated. */
  customizeRequest: (
    context: AuthOAuthTokenRequestContext,
  ) => void | Promise<void>;
}

/** OAuth token-endpoint client authentication. */
export type AuthOAuthTokenEndpointAuth =
  | AuthOAuthNoTokenEndpointAuth
  | AuthOAuthBasicTokenEndpointAuth
  | AuthOAuthPostTokenEndpointAuth
  | AuthOAuthPrivateKeyJwtTokenEndpointAuth
  | AuthOAuthCustomTokenEndpointAuth;

/** User information returned by a custom built-in social-provider hook. */
export interface AuthSocialProviderUserInfo {
  /** User attributes normalized for local persistence. */
  user: AuthOAuthUserInfo;
  /** Raw provider profile. */
  data: Record<string, unknown>;
}

/** Built-in social provider identifiers supported by AuthModule. */
export type AuthModuleSocialProviderId =
  | "apple"
  | "atlassian"
  | "cognito"
  | "discord"
  | "dropbox"
  | "facebook"
  | "figma"
  | "github"
  | "gitlab"
  | "google"
  | "huggingface"
  | "kakao"
  | "kick"
  | "line"
  | "linear"
  | "linkedin"
  | "microsoft"
  | "naver"
  | "notion"
  | "paybin"
  | "paypal"
  | "polar"
  | "railway"
  | "reddit"
  | "roblox"
  | "salesforce"
  | "slack"
  | "spotify"
  | "tiktok"
  | "twitch"
  | "twitter"
  | "vercel"
  | "vk"
  | "wechat"
  | "zoom";

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

/** Authentication provider accepted by {@link AuthModuleOptions.providers}. */
export type AuthModuleProvider =
  | AuthModuleSocialProvider
  | AuthModuleOAuthProvider;

/** Configuration options for the AuthModule. */
export interface AuthModuleOptions<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
  User extends BaseUser = BaseUser,
  Workspace extends BaseWorkspace = BaseWorkspace,
> {
  /** Application name used by authentication flows. */
  appName?: string;
  /** Public application URL used to construct authentication callbacks. */
  baseURL?: string;
  /** Base path for the auth API endpoints. */
  basePath?: string;
  /** Secret used for authentication signing and encryption. */
  secret?: string;
  /** Origins permitted to initiate browser authentication requests. */
  trustedOrigins?:
    | string[]
    | ((request?: Request) => AuthMaybePromise<(string | null | undefined)[]>);

  /** OAuth account persistence and state-validation options. */
  account?: AuthModuleAccountOptions;

  /** Session lifecycle and Cookie cache options. */
  session?: AuthModuleSessionOptions;

  /** Email and password authentication options. */
  emailAndPassword?: AuthModuleEmailAndPasswordOptions;

  /** User lifecycle, roles, permissions, and authorization ability. */
  user?: AuthModuleUserOptions<UserPermission, User>;

  /** Email verification delivery and lifecycle options. */
  emailVerification?: AuthModuleEmailVerificationOptions;

  /** Workspace lifecycle and invitation-delivery options. */
  workspace?: AuthModuleWorkspaceOptions<WorkspacePermission, Workspace>;

  /** API-key permission defaults and grant limits. */
  apiKey?: AuthModuleApiKeyOptions<
    NoInfer<UserPermission | WorkspacePermission>
  >;

  /** Built-in social and custom OAuth providers, identified by `id`. */
  providers?: readonly AuthModuleProvider[];

  /** Entity classes used for authentication and workspace access. */
  entities: {
    /** User entity class. */
    user: EntityClass<User>;
    /** Account entity class. */
    account: EntityClass<BaseAccount>;
    /** Session entity class. */
    session: EntityClass<BaseSession>;
    /** Verification entity class. */
    verification: EntityClass<BaseVerification>;
    /** Workspace entity class. */
    workspace: EntityClass<Workspace>;
    /** Workspace-invitation entity class. */
    workspaceInvitation: EntityClass<BaseWorkspaceInvitation>;
    /** Workspace-member entity class. */
    workspaceMember: EntityClass<BaseWorkspaceMember>;
    /** API key entity class. */
    apiKey: EntityClass<BaseApiKey>;
  };

  /** Middleware registration options. */
  middleware?: AuthModuleMiddlewareOptions;
}
