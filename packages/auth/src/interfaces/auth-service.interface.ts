/** Public user data returned by authentication operations. */
export interface AuthUser {
  /** Unique user identifier. */
  id: string;
  /** User display name. */
  name: string;
  /** User email address. */
  email: string;
  /** Whether the email address has been verified. */
  emailVerified: boolean;
  /** User avatar URL, or `null` when no avatar is configured. */
  image?: string | null;
  /** Timestamp when the user was created. */
  createdAt: Date;
  /** Timestamp when the user was last updated. */
  updatedAt: Date;
  /** Application-defined user fields. */
  [field: string]: unknown;
}

/** Options accepted when signing up with an email address and password. */
export interface SignUpOptions {
  /** User display name. */
  name: string;
  /** User email address. */
  email: string;
  /** Initial account password. */
  password: string;
  /** Optional user avatar URL. */
  image?: string;
  /** URL used after email verification completes. */
  callbackURL?: string;
  /** Whether the created session should persist across browser restarts. */
  rememberMe?: boolean;
  /** Application-defined user fields accepted during registration. */
  [field: string]: unknown;
}

/** Result returned after signing up with email and password. */
export interface SignUpResult<User extends AuthUser = AuthUser> {
  /** Session token, or `null` when registration does not create a session. */
  token: string | null;
  /** Newly created user. */
  user: User;
}

/** Options accepted when signing in with an email address and password. */
export interface SignInOptions {
  /** User email address. */
  email: string;
  /** Account password. */
  password: string;
  /** URL returned to the caller after successful authentication. */
  callbackURL?: string;
  /** Whether the created session should persist across browser restarts. */
  rememberMe?: boolean;
}

/** Result returned after signing in with email and password. */
export interface SignInResult<User extends AuthUser = AuthUser> {
  /** Whether the caller should redirect to {@link url}. */
  redirect: boolean;
  /** Created session token. */
  token: string;
  /** Redirect target, or `null` when no redirect was requested. */
  url: string | null;
  /** Authenticated user. */
  user: User;
}

/** Options for sending an email-verification link. */
export interface SendVerificationEmailOptions {
  /** Email address to verify. */
  email: string;
  /** URL used after email verification completes. */
  callbackURL?: string;
}

/** Options for requesting a password-reset link. */
export interface RequestPasswordResetOptions {
  /** Email address that owns the credential password. */
  email: string;
  /** URL that receives the password-reset token. */
  redirectTo?: string;
}

/** Result returned after requesting a password-reset link. */
export interface RequestPasswordResetResult {
  /** Whether the request was accepted. */
  status: boolean;
  /** Enumeration-safe message returned by the authentication backend. */
  message: string;
}

/** Options for resetting a credential password with a reset token. */
export interface ResetPasswordOptions {
  /** New password. */
  newPassword: string;
  /** Token issued by the password-reset flow. */
  token: string;
}

/** Fields accepted when updating the authenticated user. */
export interface UpdateAuthUserOptions {
  /** New display name. */
  name?: string;
  /** New avatar URL, or `null` to remove the current avatar. */
  image?: string | null;
  /** Application-defined user fields configured through Better Auth. */
  [field: string]: unknown;
}

/** Options for changing the authenticated user's email address. */
export interface ChangeAuthEmailOptions {
  /** New email address. */
  newEmail: string;
  /** URL used after email verification completes. */
  callbackURL?: string;
}

/** Options for changing the authenticated user's password. */
export interface ChangeAuthPasswordOptions {
  /** Current password used to authorize the change. */
  currentPassword: string;
  /** New password. */
  newPassword: string;
  /** Whether every session except the replacement session is revoked. */
  revokeOtherSessions?: boolean;
}

/** Result of changing the authenticated user's password. */
export interface ChangeAuthPasswordResult {
  /** Replacement session token when other sessions were revoked. */
  token: string | null;
}

/** Options for deleting the authenticated user. */
export interface DeleteAuthUserOptions {
  /** URL used after account-deletion verification completes. */
  callbackURL?: string;
  /** Current password when the session is not fresh enough. */
  password?: string;
  /** Account-deletion verification token. */
  token?: string;
}

/** Result of requesting deletion of the authenticated user. */
export interface DeleteAuthUserResult {
  /** Human-readable result supplied by the authentication backend. */
  message: string;
  /** Whether the deletion request was accepted. */
  success: boolean;
}

/** A safe summary of an authentication account linked to the current user. */
export interface AuthAccount {
  /** Better Auth account record identifier. */
  id: string;
  /** Identifier assigned by the authentication provider. */
  accountId: string;
  /** Stable issuer namespace paired with the provider account identifier. */
  issuer: string;
  /** Authentication provider identifier. */
  providerId: string;
  /** Identifier of the user that owns the account. */
  userId: string;
  /** OAuth scopes granted to the account. */
  scopes: string[];
  /** Timestamp when the account was linked. */
  createdAt: Date;
  /** Timestamp when the account was last updated. */
  updatedAt: Date;
}

/** Identifies a linked authentication account. */
export type AuthAccountSelector =
  | {
      /** Better Auth account record identifier. */
      accountId: string;
      /** Optional user identifier for trusted server-side administration flows. */
      userId?: string;
    }
  | {
      /** Selects the account stored in Better Auth's short-lived account cookie. */
      useAccountCookie: true;
      /** Optional user identifier for trusted server-side administration flows. */
      userId?: string;
    };

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

/** Provider user information returned for a linked authentication account. */
export interface AuthProviderUserInfo {
  /** Provider display name, when supplied. */
  name?: string;
  /** Provider email address, when supplied. */
  email?: string | null;
  /** Whether the provider considers the email verified. */
  emailVerified: boolean;
  /** Provider avatar URL, when supplied. */
  image?: string;
  /** Provider-defined user-info fields. */
  [field: string]: unknown;
}

/** Information associated with a linked authentication account. */
export interface AuthAccountInfo<
  UserInfo extends AuthProviderUserInfo = AuthProviderUserInfo,
  Data extends object = Record<string, unknown>,
> {
  /** Linked account identity. */
  account: Pick<AuthAccount, "id" | "providerId" | "issuer" | "accountId">;
  /** Provider user information. */
  user: UserInfo;
  /** Provider-specific account data. */
  data: Data;
}

/** Authentication result paired with response headers produced by the operation. */
export interface AuthServiceResponse<Result> {
  /** Response headers, including any session cookies. */
  headers: globalThis.Headers;
  /** Normalized authentication operation result. */
  response: Result;
}

/** Requests response headers from an AuthService transport operation. */
export interface AuthServiceResponseOptions {
  /** Enables the response envelope. */
  returnHeaders: true;
}

/** Identifies an authentication account to unlink. */
export interface UnlinkAuthAccountOptions {
  /** Better Auth account record identifier returned by {@link AuthAccount.id}. */
  accountId: string;
}
