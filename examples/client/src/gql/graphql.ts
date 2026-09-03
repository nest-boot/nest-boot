/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  /**
   * A filter for ApiKey that accepts MongoDB query syntax.
   * Supported fields: name, prefix, enabled, last_used_at, created_at
   */
  ApiKeyFilter: { input: any; output: any };
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: any; output: any };
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: {
    input: Record<string, string[]>;
    output: Record<string, string[]>;
  };
  /**
   * A filter for Workspace that accepts MongoDB query syntax.
   * Supported fields: name, created_at
   */
  WorkspaceFilter: { input: any; output: any };
  /**
   * A filter for WorkspaceMember that accepts MongoDB query syntax.
   * Supported fields: name, role, type, email, status, created_at
   */
  WorkspaceMemberFilter: { input: any; output: any };
};

export type AcceptWorkspaceInvitationResult = {
  __typename?: "AcceptWorkspaceInvitationResult";
  invitation: WorkspaceInvitation;
  member: WorkspaceMember;
};

export type AddWorkspaceMemberInput = {
  email: Scalars["String"]["input"];
};

export type ApiKey = {
  __typename?: "ApiKey";
  createdAt: Scalars["DateTime"]["output"];
  enabled: Scalars["Boolean"]["output"];
  expiresAt?: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["ID"]["output"];
  lastUsedAt?: Maybe<Scalars["DateTime"]["output"]>;
  name: Scalars["String"]["output"];
  permissions: Array<AuthPermission>;
  prefix?: Maybe<Scalars["String"]["output"]>;
  start?: Maybe<Scalars["String"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
};

export type ApiKeyConnection = {
  __typename?: "ApiKeyConnection";
  /** A list of edges. */
  edges: Array<ApiKeyEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

/** An auto-generated type which holds one ApiKey and a cursor during pagination. */
export type ApiKeyEdge = {
  __typename?: "ApiKeyEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of ApiKeyEdge. */
  node: ApiKey;
};

/** Ordering options for apikey connections */
export type ApiKeyOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order apikeys by. */
  field: ApiKeyOrderField;
};

/** Properties by which apikey connections can be ordered. */
export enum ApiKeyOrderField {
  CREATED_AT = "CREATED_AT",
  ID = "ID",
  LAST_USED_AT = "LAST_USED_AT",
}

export type AuthAccessTokenType = {
  __typename?: "AuthAccessTokenType";
  accessToken: Scalars["String"]["output"];
  accessTokenExpiresAt?: Maybe<Scalars["DateTime"]["output"]>;
  idToken?: Maybe<Scalars["String"]["output"]>;
  scopes: Array<Scalars["String"]["output"]>;
};

export type AuthAccountIdentityType = {
  __typename?: "AuthAccountIdentityType";
  accountId: Scalars["ID"]["output"];
  id: Scalars["ID"]["output"];
  issuer: Scalars["String"]["output"];
  providerId: Scalars["ID"]["output"];
};

export type AuthAccountInfoType = {
  __typename?: "AuthAccountInfoType";
  account: AuthAccountIdentityType;
  data: Scalars["JSONObject"]["output"];
  user: Scalars["JSONObject"]["output"];
};

export type AuthAccountSelectorInput = {
  accountId?: InputMaybe<Scalars["ID"]["input"]>;
  useAccountCookie?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AuthAccountType = {
  __typename?: "AuthAccountType";
  accountId: Scalars["ID"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  issuer: Scalars["String"]["output"];
  providerId: Scalars["ID"]["output"];
  scopes: Array<Scalars["String"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
  userId: Scalars["ID"]["output"];
};

export type AuthChangeEmailInput = {
  callbackURL?: InputMaybe<Scalars["String"]["input"]>;
  newEmail: Scalars["String"]["input"];
};

export type AuthChangePasswordInput = {
  currentPassword: Scalars["String"]["input"];
  newPassword: Scalars["String"]["input"];
  revokeOtherSessions?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AuthChangePasswordResultType = {
  __typename?: "AuthChangePasswordResultType";
  token?: Maybe<Scalars["String"]["output"]>;
};

export type AuthDeleteUserInput = {
  callbackURL?: InputMaybe<Scalars["String"]["input"]>;
  password?: InputMaybe<Scalars["String"]["input"]>;
  token?: InputMaybe<Scalars["String"]["input"]>;
};

export type AuthDeleteUserResultType = {
  __typename?: "AuthDeleteUserResultType";
  message: Scalars["String"]["output"];
  success: Scalars["Boolean"]["output"];
};

export enum AuthPermission {
  SESSION_DELETE = "SESSION_DELETE",
  SESSION_LIST = "SESSION_LIST",
  SESSION_REVOKE = "SESSION_REVOKE",
  USER_BAN = "USER_BAN",
  USER_CREATE = "USER_CREATE",
  USER_DELETE = "USER_DELETE",
  USER_GET = "USER_GET",
  USER_IMPERSONATE = "USER_IMPERSONATE",
  USER_IMPERSONATE_ADMINS = "USER_IMPERSONATE_ADMINS",
  USER_LIST = "USER_LIST",
  USER_SET_EMAIL = "USER_SET_EMAIL",
  USER_SET_PASSWORD = "USER_SET_PASSWORD",
  USER_SET_ROLE = "USER_SET_ROLE",
  USER_UPDATE = "USER_UPDATE",
  WORKSPACE_DELETE = "WORKSPACE_DELETE",
  WORKSPACE_INVITATION_CANCEL = "WORKSPACE_INVITATION_CANCEL",
  WORKSPACE_INVITATION_CREATE = "WORKSPACE_INVITATION_CREATE",
  WORKSPACE_MEMBER_CREATE = "WORKSPACE_MEMBER_CREATE",
  WORKSPACE_MEMBER_DELETE = "WORKSPACE_MEMBER_DELETE",
  WORKSPACE_MEMBER_UPDATE = "WORKSPACE_MEMBER_UPDATE",
  WORKSPACE_UPDATE = "WORKSPACE_UPDATE",
}

export type AuthRefreshedTokenType = {
  __typename?: "AuthRefreshedTokenType";
  accessToken?: Maybe<Scalars["String"]["output"]>;
  accessTokenExpiresAt?: Maybe<Scalars["DateTime"]["output"]>;
  accountId: Scalars["ID"]["output"];
  idToken?: Maybe<Scalars["String"]["output"]>;
  providerId: Scalars["ID"]["output"];
  refreshToken: Scalars["String"]["output"];
  refreshTokenExpiresAt?: Maybe<Scalars["DateTime"]["output"]>;
  scope?: Maybe<Scalars["String"]["output"]>;
};

export type AuthRequestPasswordResetInput = {
  email: Scalars["String"]["input"];
  redirectTo?: InputMaybe<Scalars["String"]["input"]>;
};

export type AuthRequestPasswordResetResultType = {
  __typename?: "AuthRequestPasswordResetResultType";
  message: Scalars["String"]["output"];
  status: Scalars["Boolean"]["output"];
};

export type AuthResetPasswordInput = {
  newPassword: Scalars["String"]["input"];
  token: Scalars["String"]["input"];
};

export type AuthSendVerificationEmailInput = {
  callbackURL?: InputMaybe<Scalars["String"]["input"]>;
  email: Scalars["String"]["input"];
};

export type AuthSessionType = {
  __typename?: "AuthSessionType";
  createdAt: Scalars["DateTime"]["output"];
  current: Scalars["Boolean"]["output"];
  expiresAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  ipAddress?: Maybe<Scalars["String"]["output"]>;
  token: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
  userAgent?: Maybe<Scalars["String"]["output"]>;
};

export type AuthSignInInput = {
  callbackURL?: InputMaybe<Scalars["String"]["input"]>;
  email: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
  rememberMe?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AuthSignInResultType = {
  __typename?: "AuthSignInResultType";
  redirect: Scalars["Boolean"]["output"];
  token: Scalars["String"]["output"];
  url?: Maybe<Scalars["String"]["output"]>;
  user: AuthUserType;
};

export type AuthSignUpInput = {
  callbackURL?: InputMaybe<Scalars["String"]["input"]>;
  email: Scalars["String"]["input"];
  image?: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
  rememberMe?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AuthSignUpResultType = {
  __typename?: "AuthSignUpResultType";
  token?: Maybe<Scalars["String"]["output"]>;
  user: AuthUserType;
};

export type AuthUpdateUserInput = {
  image?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type AuthUserType = {
  __typename?: "AuthUserType";
  createdAt: Scalars["DateTime"]["output"];
  email: Scalars["String"]["output"];
  emailVerified: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  image?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type CreateApiKeyInput = {
  expiresAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  name: Scalars["String"]["input"];
  permissions?: InputMaybe<Array<AuthPermission>>;
  prefix?: InputMaybe<Scalars["String"]["input"]>;
};

export type CreateApiKeyResult = {
  __typename?: "CreateApiKeyResult";
  apiKey: Scalars["String"]["output"];
  entity: ApiKey;
};

export type CreateServiceAccountWorkspaceMemberInput = {
  name: Scalars["String"]["input"];
  permissions?: InputMaybe<Array<WorkspacePermission>>;
  role?: InputMaybe<WorkspaceMemberRole>;
};

export type CreateWorkspaceInput = {
  name: Scalars["String"]["input"];
};

export type CreateWorkspaceInvitationInput = {
  email: Scalars["String"]["input"];
  role: WorkspaceMemberRole;
};

export type Mutation = {
  __typename?: "Mutation";
  acceptWorkspaceInvitation: AcceptWorkspaceInvitationResult;
  addWorkspaceMember: WorkspaceMember;
  authChangeEmail: Scalars["Boolean"]["output"];
  authChangePassword: AuthChangePasswordResultType;
  authDeleteUser: AuthDeleteUserResultType;
  authRefreshToken: AuthRefreshedTokenType;
  authRequestPasswordReset: AuthRequestPasswordResetResultType;
  authResetPassword: Scalars["Boolean"]["output"];
  authRevokeOtherSessions: Scalars["Boolean"]["output"];
  authRevokeSession: Scalars["Boolean"]["output"];
  authRevokeSessions: Scalars["Boolean"]["output"];
  authSendVerificationEmail: Scalars["Boolean"]["output"];
  authSetPassword: Scalars["Boolean"]["output"];
  authSignIn: AuthSignInResultType;
  authSignOut: Scalars["Boolean"]["output"];
  authSignUp: AuthSignUpResultType;
  authUnlinkAccount: Scalars["Boolean"]["output"];
  authUpdateUser: Scalars["Boolean"]["output"];
  cancelWorkspaceInvitation: WorkspaceInvitation;
  createApiKey: CreateApiKeyResult;
  createServiceAccountWorkspaceMember: WorkspaceMember;
  createUserApiKey: CreateApiKeyResult;
  createWorkspace: Workspace;
  createWorkspaceInvitation: WorkspaceInvitation;
  deleteApiKey: ApiKey;
  deleteUserApiKey: ApiKey;
  deleteWorkspace: Workspace;
  rejectWorkspaceInvitation: WorkspaceInvitation;
  /** @deprecated Use deleteWorkspace instead */
  removeWorkspace: Workspace;
  removeWorkspaceMember: WorkspaceMember;
  updateApiKey: ApiKey;
  updateUserApiKey: ApiKey;
  updateWorkspace: Workspace;
  updateWorkspaceMember?: Maybe<WorkspaceMember>;
};

export type MutationAcceptWorkspaceInvitationArgs = {
  invitationId: Scalars["ID"]["input"];
};

export type MutationAddWorkspaceMemberArgs = {
  input: AddWorkspaceMemberInput;
};

export type MutationAuthChangeEmailArgs = {
  input: AuthChangeEmailInput;
};

export type MutationAuthChangePasswordArgs = {
  input: AuthChangePasswordInput;
};

export type MutationAuthDeleteUserArgs = {
  input?: InputMaybe<AuthDeleteUserInput>;
};

export type MutationAuthRefreshTokenArgs = {
  input: AuthAccountSelectorInput;
};

export type MutationAuthRequestPasswordResetArgs = {
  input: AuthRequestPasswordResetInput;
};

export type MutationAuthResetPasswordArgs = {
  input: AuthResetPasswordInput;
};

export type MutationAuthRevokeSessionArgs = {
  token: Scalars["String"]["input"];
};

export type MutationAuthSendVerificationEmailArgs = {
  input: AuthSendVerificationEmailInput;
};

export type MutationAuthSetPasswordArgs = {
  newPassword: Scalars["String"]["input"];
};

export type MutationAuthSignInArgs = {
  input: AuthSignInInput;
};

export type MutationAuthSignUpArgs = {
  input: AuthSignUpInput;
};

export type MutationAuthUnlinkAccountArgs = {
  accountId: Scalars["ID"]["input"];
};

export type MutationAuthUpdateUserArgs = {
  input: AuthUpdateUserInput;
};

export type MutationCancelWorkspaceInvitationArgs = {
  invitationId: Scalars["ID"]["input"];
};

export type MutationCreateApiKeyArgs = {
  input: CreateApiKeyInput;
};

export type MutationCreateServiceAccountWorkspaceMemberArgs = {
  input: CreateServiceAccountWorkspaceMemberInput;
};

export type MutationCreateUserApiKeyArgs = {
  input: CreateApiKeyInput;
};

export type MutationCreateWorkspaceArgs = {
  input: CreateWorkspaceInput;
};

export type MutationCreateWorkspaceInvitationArgs = {
  input: CreateWorkspaceInvitationInput;
};

export type MutationDeleteApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationDeleteUserApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationRejectWorkspaceInvitationArgs = {
  invitationId: Scalars["ID"]["input"];
};

export type MutationRemoveWorkspaceMemberArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationUpdateApiKeyArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateApiKeyInput;
};

export type MutationUpdateUserApiKeyArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateApiKeyInput;
};

export type MutationUpdateWorkspaceArgs = {
  input: UpdateWorkspaceInput;
};

export type MutationUpdateWorkspaceMemberArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateWorkspaceMemberInput;
};

export enum OrderDirection {
  ASC = "ASC",
  DESC = "DESC",
}

/** Returns information about pagination in a connection, in accordance with the [Relay specification](https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo). */
export type PageInfo = {
  __typename?: "PageInfo";
  endCursor?: Maybe<Scalars["String"]["output"]>;
  /** Whether there are more pages to fetch following the current page. */
  hasNextPage: Scalars["Boolean"]["output"];
  /** Whether there are any pages prior to the current page. */
  hasPreviousPage: Scalars["Boolean"]["output"];
  startCursor?: Maybe<Scalars["String"]["output"]>;
};

export type Query = {
  __typename?: "Query";
  apiKey?: Maybe<ApiKey>;
  apiKeys: ApiKeyConnection;
  authAccessToken: AuthAccessTokenType;
  authAccountInfo: AuthAccountInfoType;
  authAccounts: Array<AuthAccountType>;
  authSessions: Array<AuthSessionType>;
  currentUser: User;
  currentUserWorkspaceInvitations: Array<WorkspaceInvitation>;
  currentWorkspace?: Maybe<Workspace>;
  currentWorkspaceMember?: Maybe<WorkspaceMember>;
  userApiKey?: Maybe<ApiKey>;
  userApiKeys: ApiKeyConnection;
  workspace?: Maybe<Workspace>;
  workspaceInvitation?: Maybe<WorkspaceInvitation>;
  workspaceInvitations: Array<WorkspaceInvitation>;
  workspaceMember?: Maybe<WorkspaceMember>;
  workspaceMembers: WorkspaceMemberConnection;
  workspaces: WorkspaceConnection;
};

export type QueryApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryApiKeysArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["ApiKeyFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<ApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryAuthAccessTokenArgs = {
  input: AuthAccountSelectorInput;
};

export type QueryAuthAccountInfoArgs = {
  input: AuthAccountSelectorInput;
};

export type QueryUserApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryUserApiKeysArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["ApiKeyFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<ApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryWorkspaceArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryWorkspaceInvitationArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryWorkspaceMemberArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryWorkspaceMembersArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceMemberFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceMemberOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryWorkspacesArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export enum TotalCountRelation {
  EQ = "EQ",
  GTE = "GTE",
}

export type UpdateApiKeyInput = {
  enabled?: InputMaybe<Scalars["Boolean"]["input"]>;
  expiresAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  permissions?: InputMaybe<Array<AuthPermission>>;
};

export type UpdateWorkspaceInput = {
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateWorkspaceMemberInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  permissions?: InputMaybe<Array<WorkspacePermission>>;
  role?: InputMaybe<WorkspaceMemberRole>;
  status?: InputMaybe<WorkspaceMemberStatus>;
};

export type User = {
  __typename?: "User";
  createdAt: Scalars["DateTime"]["output"];
  email: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  permissions: Array<UserPermission>;
  updatedAt: Scalars["DateTime"]["output"];
};

export enum UserPermission {
  SESSION_DELETE = "SESSION_DELETE",
  SESSION_LIST = "SESSION_LIST",
  SESSION_REVOKE = "SESSION_REVOKE",
  USER_BAN = "USER_BAN",
  USER_CREATE = "USER_CREATE",
  USER_DELETE = "USER_DELETE",
  USER_GET = "USER_GET",
  USER_IMPERSONATE = "USER_IMPERSONATE",
  USER_IMPERSONATE_ADMINS = "USER_IMPERSONATE_ADMINS",
  USER_LIST = "USER_LIST",
  USER_SET_EMAIL = "USER_SET_EMAIL",
  USER_SET_PASSWORD = "USER_SET_PASSWORD",
  USER_SET_ROLE = "USER_SET_ROLE",
  USER_UPDATE = "USER_UPDATE",
}

export type Workspace = {
  __typename?: "Workspace";
  createdAt: Scalars["DateTime"]["output"];
  deletedAt?: Maybe<Scalars["DateTime"]["output"]>;
  features: Array<WorkspaceFeature>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type WorkspaceConnection = {
  __typename?: "WorkspaceConnection";
  /** A list of edges. */
  edges: Array<WorkspaceEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

/** An auto-generated type which holds one Workspace and a cursor during pagination. */
export type WorkspaceEdge = {
  __typename?: "WorkspaceEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of WorkspaceEdge. */
  node: Workspace;
};

export enum WorkspaceFeature {
  AI = "AI",
}

export type WorkspaceInvitation = {
  __typename?: "WorkspaceInvitation";
  createdAt: Scalars["DateTime"]["output"];
  email: Scalars["String"]["output"];
  expiresAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  inviter: User;
  role: WorkspaceMemberRole;
  status: WorkspaceInvitationStatus;
  workspace: Workspace;
};

export enum WorkspaceInvitationStatus {
  ACCEPTED = "ACCEPTED",
  CANCELED = "CANCELED",
  PENDING = "PENDING",
  REJECTED = "REJECTED",
}

export type WorkspaceMember = {
  __typename?: "WorkspaceMember";
  createdAt: Scalars["DateTime"]["output"];
  email?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  permissions: Array<WorkspacePermission>;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  type: WorkspaceMemberType;
  updatedAt: Scalars["DateTime"]["output"];
  user?: Maybe<User>;
};

export type WorkspaceMemberConnection = {
  __typename?: "WorkspaceMemberConnection";
  /** A list of edges. */
  edges: Array<WorkspaceMemberEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

/** An auto-generated type which holds one WorkspaceMember and a cursor during pagination. */
export type WorkspaceMemberEdge = {
  __typename?: "WorkspaceMemberEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of WorkspaceMemberEdge. */
  node: WorkspaceMember;
};

/** Ordering options for workspacemember connections */
export type WorkspaceMemberOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order workspacemembers by. */
  field: WorkspaceMemberOrderField;
};

/** Properties by which workspacemember connections can be ordered. */
export enum WorkspaceMemberOrderField {
  CREATED_AT = "CREATED_AT",
  ID = "ID",
}

export enum WorkspaceMemberRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
  OWNER = "OWNER",
}

export enum WorkspaceMemberStatus {
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
}

export enum WorkspaceMemberType {
  SERVICE_ACCOUNT = "SERVICE_ACCOUNT",
  USER = "USER",
}

/** Ordering options for workspace connections */
export type WorkspaceOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order workspaces by. */
  field: WorkspaceOrderField;
};

/** Properties by which workspace connections can be ordered. */
export enum WorkspaceOrderField {
  CREATED_AT = "CREATED_AT",
  ID = "ID",
}

export enum WorkspacePermission {
  WORKSPACE_DELETE = "WORKSPACE_DELETE",
  WORKSPACE_INVITATION_CANCEL = "WORKSPACE_INVITATION_CANCEL",
  WORKSPACE_INVITATION_CREATE = "WORKSPACE_INVITATION_CREATE",
  WORKSPACE_MEMBER_CREATE = "WORKSPACE_MEMBER_CREATE",
  WORKSPACE_MEMBER_DELETE = "WORKSPACE_MEMBER_DELETE",
  WORKSPACE_MEMBER_UPDATE = "WORKSPACE_MEMBER_UPDATE",
  WORKSPACE_UPDATE = "WORKSPACE_UPDATE",
}

export type AuthSignOutFromSidebarUserMutationVariables = Exact<{
  [key: string]: never;
}>;

export type AuthSignOutFromSidebarUserMutation = {
  __typename?: "Mutation";
  authSignOut: boolean;
};

export type GetCurrentUserFromCurrentUserContextQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentUserFromCurrentUserContextQuery = {
  __typename?: "Query";
  currentUser: { __typename?: "User"; id: string; name: string; email: string };
};

export type GetCurrentUserFromAuthenticatedRouteQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentUserFromAuthenticatedRouteQuery = {
  __typename?: "Query";
  currentUser: { __typename?: "User"; id: string };
};

export type GetUserApiKeysFromUserApiKeysRouteQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  filter?: InputMaybe<Scalars["ApiKeyFilter"]["input"]>;
  orderBy?: InputMaybe<ApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetUserApiKeysFromUserApiKeysRouteQuery = {
  __typename?: "Query";
  userApiKeys: {
    __typename?: "ApiKeyConnection";
    edges: Array<{
      __typename?: "ApiKeyEdge";
      node: {
        __typename?: "ApiKey";
        id: string;
        name: string;
        start?: string | null;
        prefix?: string | null;
        enabled: boolean;
        permissions: Array<AuthPermission>;
        createdAt: any;
        lastUsedAt?: any | null;
        expiresAt?: any | null;
      };
    }>;
    pageInfo: {
      __typename?: "PageInfo";
      endCursor?: string | null;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string | null;
    };
  };
};

export type CreateUserApiKeyFromUserApiKeysRouteMutationVariables = Exact<{
  input: CreateApiKeyInput;
}>;

export type CreateUserApiKeyFromUserApiKeysRouteMutation = {
  __typename?: "Mutation";
  createUserApiKey: {
    __typename?: "CreateApiKeyResult";
    apiKey: string;
    entity: {
      __typename?: "ApiKey";
      id: string;
      name: string;
      start?: string | null;
      prefix?: string | null;
      enabled: boolean;
      permissions: Array<AuthPermission>;
      createdAt: any;
      lastUsedAt?: any | null;
      expiresAt?: any | null;
    };
  };
};

export type UpdateUserApiKeyFromUserApiKeysRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateApiKeyInput;
}>;

export type UpdateUserApiKeyFromUserApiKeysRouteMutation = {
  __typename?: "Mutation";
  updateUserApiKey: {
    __typename?: "ApiKey";
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    enabled: boolean;
    permissions: Array<AuthPermission>;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
  };
};

export type DeleteUserApiKeyFromUserApiKeysRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DeleteUserApiKeyFromUserApiKeysRouteMutation = {
  __typename?: "Mutation";
  deleteUserApiKey: {
    __typename?: "ApiKey";
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    enabled: boolean;
    permissions: Array<AuthPermission>;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
  };
};

export type GetCurrentUserFromUserRouteQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentUserFromUserRouteQuery = {
  __typename?: "Query";
  currentUser: {
    __typename?: "User";
    id: string;
    name: string;
    email: string;
    createdAt: any;
  };
};

export type UpdateUserFromUserRouteMutationVariables = Exact<{
  input: AuthUpdateUserInput;
}>;

export type UpdateUserFromUserRouteMutation = {
  __typename?: "Mutation";
  authUpdateUser: boolean;
};

export type ChangeEmailFromUserRouteMutationVariables = Exact<{
  input: AuthChangeEmailInput;
}>;

export type ChangeEmailFromUserRouteMutation = {
  __typename?: "Mutation";
  authChangeEmail: boolean;
};

export type ChangePasswordFromUserSecurityMutationVariables = Exact<{
  input: AuthChangePasswordInput;
}>;

export type ChangePasswordFromUserSecurityMutation = {
  __typename?: "Mutation";
  authChangePassword: {
    __typename?: "AuthChangePasswordResultType";
    token?: string | null;
  };
};

export type GetSessionsFromUserSecurityQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetSessionsFromUserSecurityQuery = {
  __typename?: "Query";
  authSessions: Array<{
    __typename?: "AuthSessionType";
    id: string;
    token: string;
    current: boolean;
    expiresAt: any;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: any;
  }>;
};

export type RevokeSessionFromUserSecurityMutationVariables = Exact<{
  token: Scalars["String"]["input"];
}>;

export type RevokeSessionFromUserSecurityMutation = {
  __typename?: "Mutation";
  authRevokeSession: boolean;
};

export type RevokeOtherSessionsFromUserSecurityMutationVariables = Exact<{
  [key: string]: never;
}>;

export type RevokeOtherSessionsFromUserSecurityMutation = {
  __typename?: "Mutation";
  authRevokeOtherSessions: boolean;
};

export type GetWorkspacesFromUserWorkspacesRouteQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceOrder>;
}>;

export type GetWorkspacesFromUserWorkspacesRouteQuery = {
  __typename?: "Query";
  workspaces: {
    __typename?: "WorkspaceConnection";
    edges: Array<{
      __typename?: "WorkspaceEdge";
      node: {
        __typename?: "Workspace";
        id: string;
        name: string;
        createdAt: any;
        updatedAt: any;
      };
    }>;
    pageInfo: {
      __typename?: "PageInfo";
      endCursor?: string | null;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string | null;
    };
  };
};

export type GetApiKeysFromApiKeysRouteQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  filter?: InputMaybe<Scalars["ApiKeyFilter"]["input"]>;
  orderBy?: InputMaybe<ApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetApiKeysFromApiKeysRouteQuery = {
  __typename?: "Query";
  apiKeys: {
    __typename?: "ApiKeyConnection";
    edges: Array<{
      __typename?: "ApiKeyEdge";
      node: {
        __typename?: "ApiKey";
        id: string;
        name: string;
        start?: string | null;
        prefix?: string | null;
        enabled: boolean;
        permissions: Array<AuthPermission>;
        createdAt: any;
        lastUsedAt?: any | null;
        expiresAt?: any | null;
      };
    }>;
    pageInfo: {
      __typename?: "PageInfo";
      endCursor?: string | null;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string | null;
    };
  };
};

export type CreateApiKeyFromApiKeysRouteMutationVariables = Exact<{
  input: CreateApiKeyInput;
}>;

export type CreateApiKeyFromApiKeysRouteMutation = {
  __typename?: "Mutation";
  createApiKey: {
    __typename?: "CreateApiKeyResult";
    apiKey: string;
    entity: {
      __typename?: "ApiKey";
      id: string;
      name: string;
      start?: string | null;
      prefix?: string | null;
      enabled: boolean;
      permissions: Array<AuthPermission>;
      createdAt: any;
      lastUsedAt?: any | null;
      expiresAt?: any | null;
    };
  };
};

export type UpdateApiKeyFromApiKeysRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateApiKeyInput;
}>;

export type UpdateApiKeyFromApiKeysRouteMutation = {
  __typename?: "Mutation";
  updateApiKey: {
    __typename?: "ApiKey";
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    enabled: boolean;
    permissions: Array<AuthPermission>;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
  };
};

export type DeleteApiKeyFromApiKeysRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DeleteApiKeyFromApiKeysRouteMutation = {
  __typename?: "Mutation";
  deleteApiKey: {
    __typename?: "ApiKey";
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    enabled: boolean;
    permissions: Array<AuthPermission>;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
  };
};

export type GetWorkspacesFromWorkspaceSwitcherQueryVariables = Exact<{
  first?: InputMaybe<Scalars["Int"]["input"]>;
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  query?: InputMaybe<Scalars["String"]["input"]>;
  orderBy?: InputMaybe<WorkspaceOrder>;
}>;

export type GetWorkspacesFromWorkspaceSwitcherQuery = {
  __typename?: "Query";
  workspaces: {
    __typename?: "WorkspaceConnection";
    totalCount: number;
    edges: Array<{
      __typename?: "WorkspaceEdge";
      node: { __typename?: "Workspace"; id: string; name: string };
    }>;
    pageInfo: {
      __typename?: "PageInfo";
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string | null;
      endCursor?: string | null;
    };
  };
};

export type GetCurrentWorkspaceFromWorkspaceContextQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentWorkspaceFromWorkspaceContextQuery = {
  __typename?: "Query";
  currentWorkspace?: {
    __typename?: "Workspace";
    id: string;
    name: string;
    features: Array<WorkspaceFeature>;
    createdAt: any;
    updatedAt: any;
  } | null;
};

export type GetCurrentWorkspaceMemberFromWorkspaceMemberContextQueryVariables =
  Exact<{ [key: string]: never }>;

export type GetCurrentWorkspaceMemberFromWorkspaceMemberContextQuery = {
  __typename?: "Query";
  currentWorkspaceMember?: {
    __typename?: "WorkspaceMember";
    id: string;
    role: WorkspaceMemberRole;
    name: string;
    email?: string | null;
    permissions: Array<WorkspacePermission>;
    status: WorkspaceMemberStatus;
    user?: { __typename?: "User"; email: string } | null;
  } | null;
};

export type GetCurrentWorkspaceFromWorkspaceLayoutQueryVariables = Exact<{
  workspaceId: Scalars["ID"]["input"];
}>;

export type GetCurrentWorkspaceFromWorkspaceLayoutQuery = {
  __typename?: "Query";
  workspace?: { __typename?: "Workspace"; id: string } | null;
  currentWorkspaceMember?: {
    __typename?: "WorkspaceMember";
    id: string;
    role: WorkspaceMemberRole;
  } | null;
};

export type GetCurrentWorkspaceMemberFromMemberRouteQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentWorkspaceMemberFromMemberRouteQuery = {
  __typename?: "Query";
  currentWorkspaceMember?: {
    __typename?: "WorkspaceMember";
    id: string;
    role: WorkspaceMemberRole;
  } | null;
};

export type GetWorkspaceMemberFromMemberRouteQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type GetWorkspaceMemberFromMemberRouteQuery = {
  __typename?: "Query";
  workspaceMember?: {
    __typename?: "WorkspaceMember";
    id: string;
    name: string;
    email?: string | null;
    role: WorkspaceMemberRole;
    permissions: Array<WorkspacePermission>;
    status: WorkspaceMemberStatus;
    user?: { __typename?: "User"; email: string } | null;
  } | null;
};

export type UpdateWorkspaceMemberFromMemberRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateWorkspaceMemberInput;
}>;

export type UpdateWorkspaceMemberFromMemberRouteMutation = {
  __typename?: "Mutation";
  updateWorkspaceMember?: {
    __typename?: "WorkspaceMember";
    id: string;
    name: string;
    email?: string | null;
    role: WorkspaceMemberRole;
    permissions: Array<WorkspacePermission>;
    status: WorkspaceMemberStatus;
    user?: { __typename?: "User"; email: string } | null;
  } | null;
};

export type RemoveWorkspaceMemberFromMemberRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type RemoveWorkspaceMemberFromMemberRouteMutation = {
  __typename?: "Mutation";
  removeWorkspaceMember: { __typename?: "WorkspaceMember"; id: string };
};

export type CreateWorkspaceInvitationFromInviteMemberDialogMutationVariables =
  Exact<{
    input: CreateWorkspaceInvitationInput;
  }>;

export type CreateWorkspaceInvitationFromInviteMemberDialogMutation = {
  __typename?: "Mutation";
  createWorkspaceInvitation: { __typename?: "WorkspaceInvitation"; id: string };
};

export type GetWorkspaceMembersFromMembersRouteQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceMemberFilter"]["input"]>;
  orderBy?: InputMaybe<WorkspaceMemberOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetWorkspaceMembersFromMembersRouteQuery = {
  __typename?: "Query";
  workspaceMembers: {
    __typename?: "WorkspaceMemberConnection";
    edges: Array<{
      __typename?: "WorkspaceMemberEdge";
      node: {
        __typename?: "WorkspaceMember";
        id: string;
        name: string;
        email?: string | null;
        role: WorkspaceMemberRole;
        status: WorkspaceMemberStatus;
        createdAt: any;
        user?: {
          __typename?: "User";
          id: string;
          name: string;
          email: string;
        } | null;
      };
    }>;
    pageInfo: {
      __typename?: "PageInfo";
      endCursor?: string | null;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string | null;
    };
  };
  workspaceInvitations: Array<{
    __typename?: "WorkspaceInvitation";
    id: string;
    email: string;
    role: WorkspaceMemberRole;
    status: WorkspaceInvitationStatus;
    expiresAt: any;
  }>;
};

export type CancelWorkspaceInvitationFromMembersRouteMutationVariables = Exact<{
  invitationId: Scalars["ID"]["input"];
}>;

export type CancelWorkspaceInvitationFromMembersRouteMutation = {
  __typename?: "Mutation";
  cancelWorkspaceInvitation: {
    __typename?: "WorkspaceInvitation";
    id: string;
    status: WorkspaceInvitationStatus;
  };
};

export type RemoveWorkspaceMemberFromMembersRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type RemoveWorkspaceMemberFromMembersRouteMutation = {
  __typename?: "Mutation";
  removeWorkspaceMember: { __typename?: "WorkspaceMember"; id: string };
};

export type UpdateWorkspaceMemberStatusFromMembersRouteMutationVariables =
  Exact<{
    id: Scalars["ID"]["input"];
    input: UpdateWorkspaceMemberInput;
  }>;

export type UpdateWorkspaceMemberStatusFromMembersRouteMutation = {
  __typename?: "Mutation";
  updateWorkspaceMember?: {
    __typename?: "WorkspaceMember";
    id: string;
    status: WorkspaceMemberStatus;
  } | null;
};

export type UpdateWorkspaceFromSettingsRouteMutationVariables = Exact<{
  input: UpdateWorkspaceInput;
}>;

export type UpdateWorkspaceFromSettingsRouteMutation = {
  __typename?: "Mutation";
  updateWorkspace: { __typename?: "Workspace"; id: string; name: string };
};

export type DeleteWorkspaceFromSettingsRouteMutationVariables = Exact<{
  [key: string]: never;
}>;

export type DeleteWorkspaceFromSettingsRouteMutation = {
  __typename?: "Mutation";
  deleteWorkspace: { __typename?: "Workspace"; id: string };
};

export type CreateWorkspaceFromCreateWorkspaceFormMutationVariables = Exact<{
  input: CreateWorkspaceInput;
}>;

export type CreateWorkspaceFromCreateWorkspaceFormMutation = {
  __typename?: "Mutation";
  createWorkspace: { __typename?: "Workspace"; id: string };
};

export type CreateWorkspaceFromCreateWorkspaceRouteMutationVariables = Exact<{
  input: CreateWorkspaceInput;
}>;

export type CreateWorkspaceFromCreateWorkspaceRouteMutation = {
  __typename?: "Mutation";
  createWorkspace: { __typename?: "Workspace"; id: string };
};

export type GetFirstWorkspaceFromWorkspacesRouteQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetFirstWorkspaceFromWorkspacesRouteQuery = {
  __typename?: "Query";
  workspaces: {
    __typename?: "WorkspaceConnection";
    edges: Array<{
      __typename?: "WorkspaceEdge";
      node: { __typename?: "Workspace"; id: string };
    }>;
  };
};

export type AuthSignInFromLoginFormMutationVariables = Exact<{
  input: AuthSignInInput;
}>;

export type AuthSignInFromLoginFormMutation = {
  __typename?: "Mutation";
  authSignIn: {
    __typename?: "AuthSignInResultType";
    user: { __typename?: "AuthUserType"; id: string };
  };
};

export type AuthSignUpFromLoginFormMutationVariables = Exact<{
  input: AuthSignUpInput;
}>;

export type AuthSignUpFromLoginFormMutation = {
  __typename?: "Mutation";
  authSignUp: {
    __typename?: "AuthSignUpResultType";
    user: { __typename?: "AuthUserType"; id: string };
  };
};

export type RequestPasswordResetFromForgotPasswordMutationVariables = Exact<{
  input: AuthRequestPasswordResetInput;
}>;

export type RequestPasswordResetFromForgotPasswordMutation = {
  __typename?: "Mutation";
  authRequestPasswordReset: {
    __typename?: "AuthRequestPasswordResetResultType";
    status: boolean;
  };
};

export type GetCurrentUserFromAuthLayoutQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentUserFromAuthLayoutQuery = {
  __typename?: "Query";
  currentUser: { __typename?: "User"; id: string };
};

export type ResetPasswordFromResetPasswordMutationVariables = Exact<{
  input: AuthResetPasswordInput;
}>;

export type ResetPasswordFromResetPasswordMutation = {
  __typename?: "Mutation";
  authResetPassword: boolean;
};

export type SendVerificationEmailFromVerifyEmailMutationVariables = Exact<{
  input: AuthSendVerificationEmailInput;
}>;

export type SendVerificationEmailFromVerifyEmailMutation = {
  __typename?: "Mutation";
  authSendVerificationEmail: boolean;
};

export type GetCurrentUserFromInviteRouteQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentUserFromInviteRouteQuery = {
  __typename?: "Query";
  currentUser: { __typename?: "User"; id: string; name: string; email: string };
};

export type GetWorkspaceInvitationFromInviteRouteQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type GetWorkspaceInvitationFromInviteRouteQuery = {
  __typename?: "Query";
  workspaceInvitation?: {
    __typename?: "WorkspaceInvitation";
    id: string;
    email: string;
    role: WorkspaceMemberRole;
    status: WorkspaceInvitationStatus;
    expiresAt: any;
    workspace: { __typename?: "Workspace"; id: string; name: string };
  } | null;
};

export type AcceptWorkspaceInvitationFromInviteRouteMutationVariables = Exact<{
  invitationId: Scalars["ID"]["input"];
}>;

export type AcceptWorkspaceInvitationFromInviteRouteMutation = {
  __typename?: "Mutation";
  acceptWorkspaceInvitation: {
    __typename?: "AcceptWorkspaceInvitationResult";
    invitation: {
      __typename?: "WorkspaceInvitation";
      id: string;
      status: WorkspaceInvitationStatus;
      workspace: { __typename?: "Workspace"; id: string };
    };
    member: {
      __typename?: "WorkspaceMember";
      id: string;
      name: string;
      role: WorkspaceMemberRole;
    };
  };
};

export const AuthSignOutFromSidebarUserDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "authSignOutFromSidebarUser" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "authSignOut" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  AuthSignOutFromSidebarUserMutation,
  AuthSignOutFromSidebarUserMutationVariables
>;
export const GetCurrentUserFromCurrentUserContextDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCurrentUserFromCurrentUserContext" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentUser" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetCurrentUserFromCurrentUserContextQuery,
  GetCurrentUserFromCurrentUserContextQueryVariables
>;
export const GetCurrentUserFromAuthenticatedRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCurrentUserFromAuthenticatedRoute" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentUser" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetCurrentUserFromAuthenticatedRouteQuery,
  GetCurrentUserFromAuthenticatedRouteQueryVariables
>;
export const GetUserApiKeysFromUserApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getUserApiKeysFromUserApiKeysRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "after" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "before" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "first" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "last" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "ApiKeyFilter" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "orderBy" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "ApiKeyOrder" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "query" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "userApiKeys" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "after" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "after" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "before" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "before" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "first" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "last" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "last" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "orderBy" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "orderBy" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "query" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "query" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "edges" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "node" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "id" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "name" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "start" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "prefix" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "enabled" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "permissions" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "createdAt" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "lastUsedAt" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "expiresAt" },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pageInfo" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "endCursor" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasNextPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasPreviousPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "startCursor" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetUserApiKeysFromUserApiKeysRouteQuery,
  GetUserApiKeysFromUserApiKeysRouteQueryVariables
>;
export const CreateUserApiKeyFromUserApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createUserApiKeyFromUserApiKeysRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "CreateApiKeyInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createUserApiKey" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "apiKey" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "entity" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "start" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "prefix" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "enabled" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "permissions" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "createdAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastUsedAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "expiresAt" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateUserApiKeyFromUserApiKeysRouteMutation,
  CreateUserApiKeyFromUserApiKeysRouteMutationVariables
>;
export const UpdateUserApiKeyFromUserApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateUserApiKeyFromUserApiKeysRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "UpdateApiKeyInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateUserApiKey" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "start" } },
                { kind: "Field", name: { kind: "Name", value: "prefix" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastUsedAt" } },
                { kind: "Field", name: { kind: "Name", value: "expiresAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateUserApiKeyFromUserApiKeysRouteMutation,
  UpdateUserApiKeyFromUserApiKeysRouteMutationVariables
>;
export const DeleteUserApiKeyFromUserApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deleteUserApiKeyFromUserApiKeysRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "deleteUserApiKey" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "start" } },
                { kind: "Field", name: { kind: "Name", value: "prefix" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastUsedAt" } },
                { kind: "Field", name: { kind: "Name", value: "expiresAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DeleteUserApiKeyFromUserApiKeysRouteMutation,
  DeleteUserApiKeyFromUserApiKeysRouteMutationVariables
>;
export const GetCurrentUserFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCurrentUserFromUserRoute" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentUser" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetCurrentUserFromUserRouteQuery,
  GetCurrentUserFromUserRouteQueryVariables
>;
export const UpdateUserFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateUserFromUserRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "AuthUpdateUserInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authUpdateUser" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateUserFromUserRouteMutation,
  UpdateUserFromUserRouteMutationVariables
>;
export const ChangeEmailFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "changeEmailFromUserRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "AuthChangeEmailInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authChangeEmail" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ChangeEmailFromUserRouteMutation,
  ChangeEmailFromUserRouteMutationVariables
>;
export const ChangePasswordFromUserSecurityDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "changePasswordFromUserSecurity" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "AuthChangePasswordInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authChangePassword" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "token" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ChangePasswordFromUserSecurityMutation,
  ChangePasswordFromUserSecurityMutationVariables
>;
export const GetSessionsFromUserSecurityDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getSessionsFromUserSecurity" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authSessions" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "token" } },
                { kind: "Field", name: { kind: "Name", value: "current" } },
                { kind: "Field", name: { kind: "Name", value: "expiresAt" } },
                { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                { kind: "Field", name: { kind: "Name", value: "userAgent" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetSessionsFromUserSecurityQuery,
  GetSessionsFromUserSecurityQueryVariables
>;
export const RevokeSessionFromUserSecurityDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "revokeSessionFromUserSecurity" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "token" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authRevokeSession" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "token" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "token" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RevokeSessionFromUserSecurityMutation,
  RevokeSessionFromUserSecurityMutationVariables
>;
export const RevokeOtherSessionsFromUserSecurityDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "revokeOtherSessionsFromUserSecurity" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authRevokeOtherSessions" },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RevokeOtherSessionsFromUserSecurityMutation,
  RevokeOtherSessionsFromUserSecurityMutationVariables
>;
export const GetWorkspacesFromUserWorkspacesRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getWorkspacesFromUserWorkspacesRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "after" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "before" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "first" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "last" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "orderBy" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "WorkspaceOrder" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "workspaces" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "after" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "after" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "before" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "before" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "first" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "last" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "last" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "orderBy" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "orderBy" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "edges" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "node" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "id" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "name" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "createdAt" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "updatedAt" },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pageInfo" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "endCursor" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasNextPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasPreviousPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "startCursor" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetWorkspacesFromUserWorkspacesRouteQuery,
  GetWorkspacesFromUserWorkspacesRouteQueryVariables
>;
export const GetApiKeysFromApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getApiKeysFromApiKeysRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "after" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "before" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "first" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "last" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "ApiKeyFilter" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "orderBy" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "ApiKeyOrder" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "query" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "apiKeys" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "after" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "after" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "before" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "before" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "first" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "last" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "last" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "orderBy" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "orderBy" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "query" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "query" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "edges" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "node" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "id" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "name" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "start" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "prefix" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "enabled" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "permissions" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "createdAt" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "lastUsedAt" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "expiresAt" },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pageInfo" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "endCursor" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasNextPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasPreviousPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "startCursor" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetApiKeysFromApiKeysRouteQuery,
  GetApiKeysFromApiKeysRouteQueryVariables
>;
export const CreateApiKeyFromApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createApiKeyFromApiKeysRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "CreateApiKeyInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createApiKey" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "apiKey" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "entity" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "start" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "prefix" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "enabled" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "permissions" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "createdAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "lastUsedAt" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "expiresAt" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateApiKeyFromApiKeysRouteMutation,
  CreateApiKeyFromApiKeysRouteMutationVariables
>;
export const UpdateApiKeyFromApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateApiKeyFromApiKeysRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "UpdateApiKeyInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateApiKey" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "start" } },
                { kind: "Field", name: { kind: "Name", value: "prefix" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastUsedAt" } },
                { kind: "Field", name: { kind: "Name", value: "expiresAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateApiKeyFromApiKeysRouteMutation,
  UpdateApiKeyFromApiKeysRouteMutationVariables
>;
export const DeleteApiKeyFromApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deleteApiKeyFromApiKeysRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "deleteApiKey" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "start" } },
                { kind: "Field", name: { kind: "Name", value: "prefix" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastUsedAt" } },
                { kind: "Field", name: { kind: "Name", value: "expiresAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DeleteApiKeyFromApiKeysRouteMutation,
  DeleteApiKeyFromApiKeysRouteMutationVariables
>;
export const GetWorkspacesFromWorkspaceSwitcherDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getWorkspacesFromWorkspaceSwitcher" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "first" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "after" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "before" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "query" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "orderBy" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "WorkspaceOrder" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "workspaces" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "first" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "after" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "after" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "before" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "before" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "query" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "query" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "orderBy" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "orderBy" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "edges" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "node" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "id" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "name" },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pageInfo" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasNextPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasPreviousPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "startCursor" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "endCursor" },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetWorkspacesFromWorkspaceSwitcherQuery,
  GetWorkspacesFromWorkspaceSwitcherQueryVariables
>;
export const GetCurrentWorkspaceFromWorkspaceContextDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCurrentWorkspaceFromWorkspaceContext" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentWorkspace" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "features" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetCurrentWorkspaceFromWorkspaceContextQuery,
  GetCurrentWorkspaceFromWorkspaceContextQueryVariables
>;
export const GetCurrentWorkspaceMemberFromWorkspaceMemberContextDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: {
        kind: "Name",
        value: "getCurrentWorkspaceMemberFromWorkspaceMemberContext",
      },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentWorkspaceMember" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "role" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "user" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetCurrentWorkspaceMemberFromWorkspaceMemberContextQuery,
  GetCurrentWorkspaceMemberFromWorkspaceMemberContextQueryVariables
>;
export const GetCurrentWorkspaceFromWorkspaceLayoutDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCurrentWorkspaceFromWorkspaceLayout" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "workspaceId" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "workspace" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "workspaceId" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "currentWorkspaceMember" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "role" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetCurrentWorkspaceFromWorkspaceLayoutQuery,
  GetCurrentWorkspaceFromWorkspaceLayoutQueryVariables
>;
export const GetCurrentWorkspaceMemberFromMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCurrentWorkspaceMemberFromMemberRoute" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentWorkspaceMember" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "role" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetCurrentWorkspaceMemberFromMemberRouteQuery,
  GetCurrentWorkspaceMemberFromMemberRouteQueryVariables
>;
export const GetWorkspaceMemberFromMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getWorkspaceMemberFromMemberRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "workspaceMember" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "role" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "user" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetWorkspaceMemberFromMemberRouteQuery,
  GetWorkspaceMemberFromMemberRouteQueryVariables
>;
export const UpdateWorkspaceMemberFromMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateWorkspaceMemberFromMemberRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "UpdateWorkspaceMemberInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateWorkspaceMember" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "role" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "user" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateWorkspaceMemberFromMemberRouteMutation,
  UpdateWorkspaceMemberFromMemberRouteMutationVariables
>;
export const RemoveWorkspaceMemberFromMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "removeWorkspaceMemberFromMemberRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "removeWorkspaceMember" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RemoveWorkspaceMemberFromMemberRouteMutation,
  RemoveWorkspaceMemberFromMemberRouteMutationVariables
>;
export const CreateWorkspaceInvitationFromInviteMemberDialogDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "createWorkspaceInvitationFromInviteMemberDialog",
      },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "CreateWorkspaceInvitationInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createWorkspaceInvitation" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateWorkspaceInvitationFromInviteMemberDialogMutation,
  CreateWorkspaceInvitationFromInviteMemberDialogMutationVariables
>;
export const GetWorkspaceMembersFromMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getWorkspaceMembersFromMembersRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "after" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "before" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "first" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "last" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "WorkspaceMemberFilter" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "orderBy" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "WorkspaceMemberOrder" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "query" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "workspaceMembers" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "after" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "after" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "before" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "before" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "first" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "last" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "last" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "orderBy" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "orderBy" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "query" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "query" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "edges" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "node" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "id" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "name" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "email" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "role" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "status" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "createdAt" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "user" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "id" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "name" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "email" },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pageInfo" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "endCursor" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasNextPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "hasPreviousPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "startCursor" },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "workspaceInvitations" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "role" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "expiresAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetWorkspaceMembersFromMembersRouteQuery,
  GetWorkspaceMembersFromMembersRouteQueryVariables
>;
export const CancelWorkspaceInvitationFromMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "cancelWorkspaceInvitationFromMembersRoute",
      },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationId" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "cancelWorkspaceInvitation" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "invitationId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "invitationId" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CancelWorkspaceInvitationFromMembersRouteMutation,
  CancelWorkspaceInvitationFromMembersRouteMutationVariables
>;
export const RemoveWorkspaceMemberFromMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "removeWorkspaceMemberFromMembersRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "removeWorkspaceMember" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RemoveWorkspaceMemberFromMembersRouteMutation,
  RemoveWorkspaceMemberFromMembersRouteMutationVariables
>;
export const UpdateWorkspaceMemberStatusFromMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "updateWorkspaceMemberStatusFromMembersRoute",
      },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "UpdateWorkspaceMemberInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateWorkspaceMember" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateWorkspaceMemberStatusFromMembersRouteMutation,
  UpdateWorkspaceMemberStatusFromMembersRouteMutationVariables
>;
export const UpdateWorkspaceFromSettingsRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateWorkspaceFromSettingsRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "UpdateWorkspaceInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateWorkspace" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateWorkspaceFromSettingsRouteMutation,
  UpdateWorkspaceFromSettingsRouteMutationVariables
>;
export const DeleteWorkspaceFromSettingsRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deleteWorkspaceFromSettingsRoute" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "deleteWorkspace" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DeleteWorkspaceFromSettingsRouteMutation,
  DeleteWorkspaceFromSettingsRouteMutationVariables
>;
export const CreateWorkspaceFromCreateWorkspaceFormDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createWorkspaceFromCreateWorkspaceForm" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "CreateWorkspaceInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createWorkspace" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateWorkspaceFromCreateWorkspaceFormMutation,
  CreateWorkspaceFromCreateWorkspaceFormMutationVariables
>;
export const CreateWorkspaceFromCreateWorkspaceRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createWorkspaceFromCreateWorkspaceRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "CreateWorkspaceInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createWorkspace" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateWorkspaceFromCreateWorkspaceRouteMutation,
  CreateWorkspaceFromCreateWorkspaceRouteMutationVariables
>;
export const GetFirstWorkspaceFromWorkspacesRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getFirstWorkspaceFromWorkspacesRoute" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "workspaces" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "1" },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "edges" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "node" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "id" },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetFirstWorkspaceFromWorkspacesRouteQuery,
  GetFirstWorkspaceFromWorkspacesRouteQueryVariables
>;
export const AuthSignInFromLoginFormDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "authSignInFromLoginForm" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "AuthSignInInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authSignIn" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "user" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  AuthSignInFromLoginFormMutation,
  AuthSignInFromLoginFormMutationVariables
>;
export const AuthSignUpFromLoginFormDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "authSignUpFromLoginForm" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "AuthSignUpInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authSignUp" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "user" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  AuthSignUpFromLoginFormMutation,
  AuthSignUpFromLoginFormMutationVariables
>;
export const RequestPasswordResetFromForgotPasswordDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "requestPasswordResetFromForgotPassword" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "AuthRequestPasswordResetInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authRequestPasswordReset" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "status" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RequestPasswordResetFromForgotPasswordMutation,
  RequestPasswordResetFromForgotPasswordMutationVariables
>;
export const GetCurrentUserFromAuthLayoutDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCurrentUserFromAuthLayout" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentUser" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetCurrentUserFromAuthLayoutQuery,
  GetCurrentUserFromAuthLayoutQueryVariables
>;
export const ResetPasswordFromResetPasswordDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "resetPasswordFromResetPassword" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "AuthResetPasswordInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authResetPassword" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ResetPasswordFromResetPasswordMutation,
  ResetPasswordFromResetPasswordMutationVariables
>;
export const SendVerificationEmailFromVerifyEmailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "sendVerificationEmailFromVerifyEmail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "AuthSendVerificationEmailInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "authSendVerificationEmail" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SendVerificationEmailFromVerifyEmailMutation,
  SendVerificationEmailFromVerifyEmailMutationVariables
>;
export const GetCurrentUserFromInviteRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getCurrentUserFromInviteRoute" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentUser" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetCurrentUserFromInviteRouteQuery,
  GetCurrentUserFromInviteRouteQueryVariables
>;
export const GetWorkspaceInvitationFromInviteRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getWorkspaceInvitationFromInviteRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "workspaceInvitation" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "role" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "expiresAt" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "workspace" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetWorkspaceInvitationFromInviteRouteQuery,
  GetWorkspaceInvitationFromInviteRouteQueryVariables
>;
export const AcceptWorkspaceInvitationFromInviteRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "acceptWorkspaceInvitationFromInviteRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationId" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "acceptWorkspaceInvitation" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "invitationId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "invitationId" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "invitation" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "status" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "workspace" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "id" },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "member" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "role" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  AcceptWorkspaceInvitationFromInviteRouteMutation,
  AcceptWorkspaceInvitationFromInviteRouteMutationVariables
>;
