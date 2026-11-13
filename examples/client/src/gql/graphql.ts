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
   * A filter for Account that accepts MongoDB query syntax.
   * Supported fields: created_at, provider_id
   */
  AccountFilter: { input: any; output: any };
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: any; output: any };
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  };
  /**
   * A filter for Job that accepts MongoDB query syntax.
   * Supported fields: id, queue, name, status, created_at
   */
  JobFilter: { input: any; output: any };
  /**
   * A filter for Session that accepts MongoDB query syntax.
   * Supported fields: created_at
   */
  SessionFilter: { input: any; output: any };
  /**
   * A filter for SystemAccount that accepts MongoDB query syntax.
   * Supported fields: name, enabled, created_at
   */
  SystemAccountFilter: { input: any; output: any };
  /**
   * A filter for SystemApiKey that accepts MongoDB query syntax.
   * Supported fields: name, prefix, revoked_at, last_used_at, created_at
   */
  SystemApiKeyFilter: { input: any; output: any };
  /**
   * A filter for UserApiKey that accepts MongoDB query syntax.
   * Supported fields: name, prefix, revoked_at, last_used_at, created_at
   */
  UserApiKeyFilter: { input: any; output: any };
  /**
   * A filter for User that accepts MongoDB query syntax.
   * Supported fields: name, email, created_at
   */
  UserFilter: { input: any; output: any };
  /**
   * A filter for WorkspaceApiKey that accepts MongoDB query syntax.
   * Supported fields: name, prefix, revoked_at, last_used_at, created_at
   */
  WorkspaceApiKeyFilter: { input: any; output: any };
  /**
   * A filter for Workspace that accepts MongoDB query syntax.
   * Supported fields: name, created_at
   */
  WorkspaceFilter: { input: any; output: any };
  /**
   * A filter for WorkspaceInvitation that accepts MongoDB query syntax.
   * Supported fields: email, status, created_at
   */
  WorkspaceInvitationFilter: { input: any; output: any };
  /**
   * A filter for WorkspaceMember that accepts MongoDB query syntax.
   * Supported fields: name, email, type, status, created_at
   */
  WorkspaceMemberFilter: { input: any; output: any };
};

export type AcceptWorkspaceInvitationPayload = {
  __typename?: "AcceptWorkspaceInvitationPayload";
  id: Scalars["ID"]["output"];
  memberId: Scalars["ID"]["output"];
  workspaceId: Scalars["ID"]["output"];
};

export type Account = {
  __typename?: "Account";
  accountId: Scalars["ID"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  issuer: Scalars["String"]["output"];
  providerId: Scalars["ID"]["output"];
  scopes: Array<Scalars["String"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
};

export type AccountConnection = {
  __typename?: "AccountConnection";
  /** A list of edges. */
  edges: Array<AccountEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

/** An auto-generated type which holds one Account and a cursor during pagination. */
export type AccountEdge = {
  __typename?: "AccountEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of AccountEdge. */
  node: Account;
};

/** Ordering options for account connections */
export type AccountOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order accounts by. */
  field: AccountOrderField;
};

/** Properties by which account connections can be ordered. */
export const AccountOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
} as const;

export type AccountOrderField =
  (typeof AccountOrderField)[keyof typeof AccountOrderField];
export type AddWorkspaceMemberInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  permissions?: InputMaybe<Array<WorkspacePermission>>;
  roles?: InputMaybe<Array<WorkspaceRole>>;
  type?: InputMaybe<WorkspaceMemberType>;
};

export type AddWorkspaceMemberPayload = {
  __typename?: "AddWorkspaceMemberPayload";
  id: Scalars["ID"]["output"];
};

export type AuthAbilityRuleType = {
  __typename?: "AuthAbilityRuleType";
  actions: Array<Scalars["String"]["output"]>;
  conditions?: Maybe<Scalars["JSONObject"]["output"]>;
  fields?: Maybe<Array<Scalars["String"]["output"]>>;
  inverted: Scalars["Boolean"]["output"];
  reason?: Maybe<Scalars["String"]["output"]>;
  subjects: Array<Scalars["String"]["output"]>;
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

export type AuthLinkSocialAccountInput = {
  callbackURL?: InputMaybe<Scalars["String"]["input"]>;
  errorCallbackURL?: InputMaybe<Scalars["String"]["input"]>;
  loginHint?: InputMaybe<Scalars["String"]["input"]>;
  provider: Scalars["String"]["input"];
  scopes?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

export type AuthLinkSocialAccountResultType = {
  __typename?: "AuthLinkSocialAccountResultType";
  redirect: Scalars["Boolean"]["output"];
  url: Scalars["String"]["output"];
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
  user: User;
};

export type AuthSignInSocialInput = {
  callbackURL?: InputMaybe<Scalars["String"]["input"]>;
  errorCallbackURL?: InputMaybe<Scalars["String"]["input"]>;
  loginHint?: InputMaybe<Scalars["String"]["input"]>;
  newUserCallbackURL?: InputMaybe<Scalars["String"]["input"]>;
  provider: Scalars["String"]["input"];
  requestSignUp?: InputMaybe<Scalars["Boolean"]["input"]>;
  scopes?: InputMaybe<Array<Scalars["String"]["input"]>>;
};

export type AuthSignInSocialResultType = {
  __typename?: "AuthSignInSocialResultType";
  redirect: Scalars["Boolean"]["output"];
  token?: Maybe<Scalars["String"]["output"]>;
  url?: Maybe<Scalars["String"]["output"]>;
  user?: Maybe<User>;
};

export type AuthSignUpInput = {
  callbackURL?: InputMaybe<Scalars["String"]["input"]>;
  email: Scalars["String"]["input"];
  image?: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
  rememberMe?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AuthSocialProviderType = {
  __typename?: "AuthSocialProviderType";
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
};

export type AuthUpdateUserInput = {
  image?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type BanUserInput = {
  expiresIn?: InputMaybe<Scalars["Int"]["input"]>;
  reason?: InputMaybe<Scalars["String"]["input"]>;
};

export type BanUserPayload = {
  __typename?: "BanUserPayload";
  id: Scalars["ID"]["output"];
};

export type CancelWorkspaceInvitationPayload = {
  __typename?: "CancelWorkspaceInvitationPayload";
  id: Scalars["ID"]["output"];
};

export type CreateSystemAccountInput = {
  name: Scalars["String"]["input"];
  permissions?: InputMaybe<Array<SystemAccountPermission>>;
};

export type CreateSystemApiKeyInput = {
  expiresAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  name: Scalars["String"]["input"];
  permissions?: InputMaybe<Array<SystemApiKeyPermission>>;
  prefix?: InputMaybe<Scalars["String"]["input"]>;
  systemAccountId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type CreateSystemApiKeyResult = {
  __typename?: "CreateSystemApiKeyResult";
  apiKey: Scalars["String"]["output"];
  entity: SystemApiKey;
};

export type CreateUserApiKeyInput = {
  expiresAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  name: Scalars["String"]["input"];
  permissions?: InputMaybe<Array<UserApiKeyPermission>>;
  prefix?: InputMaybe<Scalars["String"]["input"]>;
};

export type CreateUserApiKeyResult = {
  __typename?: "CreateUserApiKeyResult";
  apiKey: Scalars["String"]["output"];
  entity: UserApiKey;
};

export type CreateUserInput = {
  email: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
  permissions?: InputMaybe<Array<UserPermission>>;
  roles?: InputMaybe<Array<UserRole>>;
};

export type CreateUserPayload = {
  __typename?: "CreateUserPayload";
  id: Scalars["ID"]["output"];
};

export type CreateWorkspaceApiKeyInput = {
  expiresAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  memberId?: InputMaybe<Scalars["ID"]["input"]>;
  name: Scalars["String"]["input"];
  permissions?: InputMaybe<Array<WorkspaceApiKeyPermission>>;
  prefix?: InputMaybe<Scalars["String"]["input"]>;
};

export type CreateWorkspaceApiKeyResult = {
  __typename?: "CreateWorkspaceApiKeyResult";
  apiKey: Scalars["String"]["output"];
  entity: WorkspaceApiKey;
};

export type CreateWorkspaceInput = {
  name: Scalars["String"]["input"];
};

export type CreateWorkspaceInvitationInput = {
  email: Scalars["String"]["input"];
  expiresIn?: InputMaybe<Scalars["Int"]["input"]>;
  roles: Array<WorkspaceRole>;
};

export type CreateWorkspaceInvitationPayload = {
  __typename?: "CreateWorkspaceInvitationPayload";
  id: Scalars["ID"]["output"];
};

export type CreateWorkspacePayload = {
  __typename?: "CreateWorkspacePayload";
  id: Scalars["ID"]["output"];
};

export type DeleteUserPayload = {
  __typename?: "DeleteUserPayload";
  id: Scalars["ID"]["output"];
};

export type DeleteWorkspacePayload = {
  __typename?: "DeleteWorkspacePayload";
  id: Scalars["ID"]["output"];
};

export type Job = {
  __typename?: "Job";
  createdAt: Scalars["DateTime"]["output"];
  finishedAt?: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  progress?: Maybe<Scalars["Float"]["output"]>;
  queue: Scalars["String"]["output"];
  startedAt?: Maybe<Scalars["DateTime"]["output"]>;
  status: JobStatus;
};

export type JobConnection = {
  __typename?: "JobConnection";
  /** A list of edges. */
  edges: Array<JobEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

/** An auto-generated type which holds one Job and a cursor during pagination. */
export type JobEdge = {
  __typename?: "JobEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of JobEdge. */
  node: Job;
};

/** Ordering options for job connections */
export type JobOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order jobs by. */
  field: JobOrderField;
};

/** Properties by which job connections can be ordered. */
export const JobOrderField = {
  CREATED_AT: "CREATED_AT",
} as const;

export type JobOrderField = (typeof JobOrderField)[keyof typeof JobOrderField];
export const JobStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  DELAYED: "DELAYED",
  FAILED: "FAILED",
  PRIORITIZED: "PRIORITIZED",
  UNKNOWN: "UNKNOWN",
  WAITING: "WAITING",
  WAITING_CHILDREN: "WAITING_CHILDREN",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
export type LeaveWorkspacePayload = {
  __typename?: "LeaveWorkspacePayload";
  memberId: Scalars["ID"]["output"];
};

export type Mutation = {
  __typename?: "Mutation";
  acceptWorkspaceInvitation: AcceptWorkspaceInvitationPayload;
  addWorkspaceMember: AddWorkspaceMemberPayload;
  banUser: BanUserPayload;
  cancelWorkspaceInvitation: CancelWorkspaceInvitationPayload;
  changeCurrentUserEmail: Scalars["Boolean"]["output"];
  changeCurrentUserPassword: AuthChangePasswordResultType;
  createSystemAccount: SystemAccount;
  createSystemApiKey: CreateSystemApiKeyResult;
  createUser: CreateUserPayload;
  createUserApiKey: CreateUserApiKeyResult;
  createWorkspace: CreateWorkspacePayload;
  createWorkspaceApiKey: CreateWorkspaceApiKeyResult;
  createWorkspaceInvitation: CreateWorkspaceInvitationPayload;
  deleteCurrentUser: AuthDeleteUserResultType;
  deletePlatformWorkspace: Workspace;
  deleteSystemAccount: SystemAccount;
  deleteSystemApiKey: SystemApiKey;
  deleteUser: DeleteUserPayload;
  deleteUserApiKey: UserApiKey;
  deleteWorkspace: DeleteWorkspacePayload;
  deleteWorkspaceApiKey: WorkspaceApiKey;
  impersonateUser: User;
  leaveWorkspace: LeaveWorkspacePayload;
  linkCurrentUserAccount: AuthLinkSocialAccountResultType;
  rejectWorkspaceInvitation: RejectWorkspaceInvitationPayload;
  removeWorkspaceMember: RemoveWorkspaceMemberPayload;
  requestPasswordReset: AuthRequestPasswordResetResultType;
  resetPassword: Scalars["Boolean"]["output"];
  revokeCurrentUserOtherSessions: Scalars["Boolean"]["output"];
  revokeCurrentUserSession: Scalars["Boolean"]["output"];
  revokeCurrentUserSessions: Scalars["Boolean"]["output"];
  revokeSession: Scalars["Boolean"]["output"];
  revokeSystemApiKey: SystemApiKey;
  revokeUserApiKey: UserApiKey;
  revokeUserSessions: Scalars["Boolean"]["output"];
  revokeWorkspaceApiKey: WorkspaceApiKey;
  sendVerificationEmail: Scalars["Boolean"]["output"];
  setCurrentUserPassword: Scalars["Boolean"]["output"];
  setUserPassword: Scalars["Boolean"]["output"];
  setUserPermissions: SetUserPermissionsPayload;
  setUserRoles: SetUserRolesPayload;
  setWorkspaceMemberPermissions: SetWorkspaceMemberPermissionsPayload;
  setWorkspaceMemberRoles: SetWorkspaceMemberRolesPayload;
  signIn: AuthSignInResultType;
  signInSocial: AuthSignInSocialResultType;
  signOut: Scalars["Boolean"]["output"];
  signUp: SignUpPayload;
  stopImpersonating?: Maybe<User>;
  unbanUser: UnbanUserPayload;
  unlinkCurrentUserAccount: Scalars["Boolean"]["output"];
  updateCurrentUser: Scalars["Boolean"]["output"];
  updatePlatformWorkspace: Workspace;
  updateSystemAccount: SystemAccount;
  updateSystemApiKey: SystemApiKey;
  updateUser: UpdateUserPayload;
  updateUserApiKey: UserApiKey;
  updateWorkspace: UpdateWorkspacePayload;
  updateWorkspaceApiKey: WorkspaceApiKey;
  updateWorkspaceMember?: Maybe<UpdateWorkspaceMemberPayload>;
};

export type MutationAcceptWorkspaceInvitationArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationAddWorkspaceMemberArgs = {
  input: AddWorkspaceMemberInput;
};

export type MutationBanUserArgs = {
  id: Scalars["ID"]["input"];
  input?: InputMaybe<BanUserInput>;
};

export type MutationCancelWorkspaceInvitationArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationChangeCurrentUserEmailArgs = {
  input: AuthChangeEmailInput;
};

export type MutationChangeCurrentUserPasswordArgs = {
  input: AuthChangePasswordInput;
};

export type MutationCreateSystemAccountArgs = {
  input: CreateSystemAccountInput;
};

export type MutationCreateSystemApiKeyArgs = {
  input: CreateSystemApiKeyInput;
};

export type MutationCreateUserArgs = {
  input: CreateUserInput;
};

export type MutationCreateUserApiKeyArgs = {
  input: CreateUserApiKeyInput;
};

export type MutationCreateWorkspaceArgs = {
  input: CreateWorkspaceInput;
};

export type MutationCreateWorkspaceApiKeyArgs = {
  input: CreateWorkspaceApiKeyInput;
};

export type MutationCreateWorkspaceInvitationArgs = {
  input: CreateWorkspaceInvitationInput;
};

export type MutationDeleteCurrentUserArgs = {
  input?: InputMaybe<AuthDeleteUserInput>;
};

export type MutationDeletePlatformWorkspaceArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationDeleteSystemAccountArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationDeleteSystemApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationDeleteUserArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationDeleteUserApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationDeleteWorkspaceArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationDeleteWorkspaceApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationImpersonateUserArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationLinkCurrentUserAccountArgs = {
  input: AuthLinkSocialAccountInput;
};

export type MutationRejectWorkspaceInvitationArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationRemoveWorkspaceMemberArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationRequestPasswordResetArgs = {
  input: AuthRequestPasswordResetInput;
};

export type MutationResetPasswordArgs = {
  input: AuthResetPasswordInput;
};

export type MutationRevokeCurrentUserSessionArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationRevokeSessionArgs = {
  id: Scalars["ID"]["input"];
  userId: Scalars["ID"]["input"];
};

export type MutationRevokeSystemApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationRevokeUserApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationRevokeUserSessionsArgs = {
  userId: Scalars["ID"]["input"];
};

export type MutationRevokeWorkspaceApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationSendVerificationEmailArgs = {
  input: AuthSendVerificationEmailInput;
};

export type MutationSetCurrentUserPasswordArgs = {
  newPassword: Scalars["String"]["input"];
};

export type MutationSetUserPasswordArgs = {
  id: Scalars["ID"]["input"];
  input: SetUserPasswordInput;
};

export type MutationSetUserPermissionsArgs = {
  id: Scalars["ID"]["input"];
  input: SetUserPermissionsInput;
};

export type MutationSetUserRolesArgs = {
  id: Scalars["ID"]["input"];
  input: SetUserRolesInput;
};

export type MutationSetWorkspaceMemberPermissionsArgs = {
  id: Scalars["ID"]["input"];
  input: SetWorkspaceMemberPermissionsInput;
};

export type MutationSetWorkspaceMemberRolesArgs = {
  id: Scalars["ID"]["input"];
  input: SetWorkspaceMemberRolesInput;
};

export type MutationSignInArgs = {
  input: AuthSignInInput;
};

export type MutationSignInSocialArgs = {
  input: AuthSignInSocialInput;
};

export type MutationSignUpArgs = {
  input: AuthSignUpInput;
};

export type MutationUnbanUserArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationUnlinkCurrentUserAccountArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationUpdateCurrentUserArgs = {
  input: AuthUpdateUserInput;
};

export type MutationUpdatePlatformWorkspaceArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateWorkspaceInput;
};

export type MutationUpdateSystemAccountArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateSystemAccountInput;
};

export type MutationUpdateSystemApiKeyArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateSystemApiKeyInput;
};

export type MutationUpdateUserArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateUserInput;
};

export type MutationUpdateUserApiKeyArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateUserApiKeyInput;
};

export type MutationUpdateWorkspaceArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateWorkspaceInput;
};

export type MutationUpdateWorkspaceApiKeyArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateWorkspaceApiKeyInput;
};

export type MutationUpdateWorkspaceMemberArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateWorkspaceMemberInput;
};

export const OrderDirection = {
  ASC: "ASC",
  DESC: "DESC",
} as const;

export type OrderDirection =
  (typeof OrderDirection)[keyof typeof OrderDirection];
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

export type PasswordPolicy = {
  __typename?: "PasswordPolicy";
  maxLength: Scalars["Int"]["output"];
  minLength: Scalars["Int"]["output"];
};

export type Query = {
  __typename?: "Query";
  currentAbilityRules: Array<AuthAbilityRuleType>;
  currentSession?: Maybe<Session>;
  currentUser: User;
  currentWorkspace?: Maybe<Workspace>;
  currentWorkspaceMember?: Maybe<WorkspaceMember>;
  passwordPolicy: PasswordPolicy;
  platformWorkspace?: Maybe<Workspace>;
  socialProviders: Array<AuthSocialProviderType>;
  systemAccount?: Maybe<SystemAccount>;
  systemAccountPermissions: Array<SystemAccountPermissionOption>;
  systemAccounts: SystemAccountConnection;
  systemApiKey?: Maybe<SystemApiKey>;
  systemApiKeyPermissions: Array<SystemApiKeyPermissionOption>;
  systemApiKeys: SystemApiKeyConnection;
  systemJob?: Maybe<Job>;
  systemJobs: JobConnection;
  user?: Maybe<User>;
  userApiKeyPermissions: Array<UserApiKeyPermissionOption>;
  userJob?: Maybe<Job>;
  userJobs: JobConnection;
  userPermissions: Array<UserPermissionOption>;
  userRoles: Array<UserRoleOption>;
  users: UserConnection;
  workspace?: Maybe<Workspace>;
  workspaceApiKeyPermissions: Array<WorkspaceApiKeyPermissionOption>;
  workspaceApiKeys: WorkspaceApiKeyConnection;
  workspaceInvitation?: Maybe<WorkspaceInvitation>;
  workspaceJob?: Maybe<Job>;
  workspaceJobs: JobConnection;
  workspaceMember?: Maybe<WorkspaceMember>;
  workspacePermissions: Array<WorkspacePermissionOption>;
  workspaceRoles: Array<WorkspaceRoleOption>;
  workspaces: WorkspaceConnection;
};

export type QueryPlatformWorkspaceArgs = {
  id: Scalars["ID"]["input"];
};

export type QuerySystemAccountArgs = {
  id: Scalars["ID"]["input"];
};

export type QuerySystemAccountsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["SystemAccountFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<SystemAccountOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QuerySystemApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type QuerySystemApiKeyPermissionsArgs = {
  apiKeyId?: InputMaybe<Scalars["ID"]["input"]>;
  systemAccountId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type QuerySystemApiKeysArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["SystemApiKeyFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<SystemApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QuerySystemJobArgs = {
  id: Scalars["ID"]["input"];
};

export type QuerySystemJobsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["JobFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<JobOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryUserArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryUserJobArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryUserJobsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["JobFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<JobOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryUsersArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["UserFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<UserOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryWorkspaceArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryWorkspaceApiKeysArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceApiKeyFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryWorkspaceInvitationArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryWorkspaceJobArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryWorkspaceJobsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["JobFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<JobOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryWorkspaceMemberArgs = {
  id: Scalars["ID"]["input"];
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

export type RejectWorkspaceInvitationPayload = {
  __typename?: "RejectWorkspaceInvitationPayload";
  id: Scalars["ID"]["output"];
};

export type RemoveWorkspaceMemberPayload = {
  __typename?: "RemoveWorkspaceMemberPayload";
  id: Scalars["ID"]["output"];
};

export type Session = {
  __typename?: "Session";
  createdAt: Scalars["DateTime"]["output"];
  current: Scalars["Boolean"]["output"];
  expiresAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  impersonatedBy?: Maybe<User>;
  impersonatedById?: Maybe<Scalars["ID"]["output"]>;
  ipAddress?: Maybe<Scalars["String"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
  userAgent?: Maybe<Scalars["String"]["output"]>;
};

export type SessionConnection = {
  __typename?: "SessionConnection";
  /** A list of edges. */
  edges: Array<SessionEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

/** An auto-generated type which holds one Session and a cursor during pagination. */
export type SessionEdge = {
  __typename?: "SessionEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of SessionEdge. */
  node: Session;
};

/** Ordering options for session connections */
export type SessionOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order sessions by. */
  field: SessionOrderField;
};

/** Properties by which session connections can be ordered. */
export const SessionOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
} as const;

export type SessionOrderField =
  (typeof SessionOrderField)[keyof typeof SessionOrderField];
export type SetUserPasswordInput = {
  password: Scalars["String"]["input"];
};

export type SetUserPermissionsInput = {
  permissions: Array<UserPermission>;
};

export type SetUserPermissionsPayload = {
  __typename?: "SetUserPermissionsPayload";
  id: Scalars["ID"]["output"];
};

export type SetUserRolesInput = {
  roles: Array<UserRole>;
};

export type SetUserRolesPayload = {
  __typename?: "SetUserRolesPayload";
  id: Scalars["ID"]["output"];
};

export type SetWorkspaceMemberPermissionsInput = {
  permissions: Array<WorkspacePermission>;
};

export type SetWorkspaceMemberPermissionsPayload = {
  __typename?: "SetWorkspaceMemberPermissionsPayload";
  id: Scalars["ID"]["output"];
};

export type SetWorkspaceMemberRolesInput = {
  roles: Array<WorkspaceRole>;
};

export type SetWorkspaceMemberRolesPayload = {
  __typename?: "SetWorkspaceMemberRolesPayload";
  id: Scalars["ID"]["output"];
};

export type SignUpPayload = {
  __typename?: "SignUpPayload";
  id: Scalars["ID"]["output"];
  token?: Maybe<Scalars["String"]["output"]>;
};

export type SystemAccount = {
  __typename?: "SystemAccount";
  apiKeyPermissions: Array<SystemApiKeyPermissionOption>;
  apiKeys: SystemApiKeyConnection;
  createdAt: Scalars["DateTime"]["output"];
  createdById?: Maybe<Scalars["ID"]["output"]>;
  enabled: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  permissions: Array<SystemAccountPermission>;
  updatedAt: Scalars["DateTime"]["output"];
};

export type SystemAccountApiKeysArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["SystemApiKeyFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<SystemApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type SystemAccountConnection = {
  __typename?: "SystemAccountConnection";
  /** A list of edges. */
  edges: Array<SystemAccountEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

export type SystemAccountEdge = {
  __typename?: "SystemAccountEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of SystemAccountEdge. */
  node: SystemAccount;
};

/** Ordering options for systemaccount connections */
export type SystemAccountOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order systemaccounts by. */
  field: SystemAccountOrderField;
};

/** Properties by which systemaccount connections can be ordered. */
export const SystemAccountOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
} as const;

export type SystemAccountOrderField =
  (typeof SystemAccountOrderField)[keyof typeof SystemAccountOrderField];
export const SystemAccountPermission = {
  USER__DELETE: "USER__DELETE",
  USER__READ: "USER__READ",
  USER__UPDATE: "USER__UPDATE",
  WORKSPACE__DELETE_ANY: "WORKSPACE__DELETE_ANY",
  WORKSPACE__READ_ANY: "WORKSPACE__READ_ANY",
  WORKSPACE__UPDATE_ANY: "WORKSPACE__UPDATE_ANY",
} as const;

export type SystemAccountPermission =
  (typeof SystemAccountPermission)[keyof typeof SystemAccountPermission];
export type SystemAccountPermissionOption = {
  __typename?: "SystemAccountPermissionOption";
  default: Scalars["Boolean"]["output"];
  grantable: Scalars["Boolean"]["output"];
  permission: SystemAccountPermission;
};

export type SystemApiKey = {
  __typename?: "SystemApiKey";
  createdAt: Scalars["DateTime"]["output"];
  createdById?: Maybe<Scalars["ID"]["output"]>;
  expiresAt?: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["ID"]["output"];
  lastUsedAt?: Maybe<Scalars["DateTime"]["output"]>;
  name: Scalars["String"]["output"];
  permissions: Array<SystemApiKeyPermission>;
  prefix?: Maybe<Scalars["String"]["output"]>;
  revokedAt?: Maybe<Scalars["DateTime"]["output"]>;
  start?: Maybe<Scalars["String"]["output"]>;
  systemAccount?: Maybe<SystemAccount>;
  updatedAt: Scalars["DateTime"]["output"];
};

export type SystemApiKeyConnection = {
  __typename?: "SystemApiKeyConnection";
  /** A list of edges. */
  edges: Array<SystemApiKeyEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

export type SystemApiKeyEdge = {
  __typename?: "SystemApiKeyEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of SystemApiKeyEdge. */
  node: SystemApiKey;
};

/** Ordering options for systemapikey connections */
export type SystemApiKeyOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order systemapikeys by. */
  field: SystemApiKeyOrderField;
};

/** Properties by which systemapikey connections can be ordered. */
export const SystemApiKeyOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
  LAST_USED_AT: "LAST_USED_AT",
  REVOKED_AT: "REVOKED_AT",
} as const;

export type SystemApiKeyOrderField =
  (typeof SystemApiKeyOrderField)[keyof typeof SystemApiKeyOrderField];
export const SystemApiKeyPermission = {
  USER__DELETE: "USER__DELETE",
  USER__READ: "USER__READ",
  USER__UPDATE: "USER__UPDATE",
  WORKSPACE__DELETE_ANY: "WORKSPACE__DELETE_ANY",
  WORKSPACE__READ_ANY: "WORKSPACE__READ_ANY",
  WORKSPACE__UPDATE_ANY: "WORKSPACE__UPDATE_ANY",
} as const;

export type SystemApiKeyPermission =
  (typeof SystemApiKeyPermission)[keyof typeof SystemApiKeyPermission];
export type SystemApiKeyPermissionOption = {
  __typename?: "SystemApiKeyPermissionOption";
  default: Scalars["Boolean"]["output"];
  grantable: Scalars["Boolean"]["output"];
  permission: SystemApiKeyPermission;
};

export const TotalCountRelation = {
  EQ: "EQ",
  GTE: "GTE",
} as const;

export type TotalCountRelation =
  (typeof TotalCountRelation)[keyof typeof TotalCountRelation];
export type UnbanUserPayload = {
  __typename?: "UnbanUserPayload";
  id: Scalars["ID"]["output"];
};

export type UpdateSystemAccountInput = {
  enabled?: InputMaybe<Scalars["Boolean"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  permissions?: InputMaybe<Array<SystemAccountPermission>>;
};

export type UpdateSystemApiKeyInput = {
  expiresAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  permissions?: InputMaybe<Array<SystemApiKeyPermission>>;
};

export type UpdateUserApiKeyInput = {
  expiresAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  permissions?: InputMaybe<Array<UserApiKeyPermission>>;
};

export type UpdateUserInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  emailVerified?: InputMaybe<Scalars["Boolean"]["input"]>;
  image?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateUserPayload = {
  __typename?: "UpdateUserPayload";
  id: Scalars["ID"]["output"];
};

export type UpdateWorkspaceApiKeyInput = {
  expiresAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  permissions?: InputMaybe<Array<WorkspaceApiKeyPermission>>;
};

export type UpdateWorkspaceInput = {
  name?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateWorkspaceMemberInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<WorkspaceMemberStatus>;
};

export type UpdateWorkspaceMemberPayload = {
  __typename?: "UpdateWorkspaceMemberPayload";
  id: Scalars["ID"]["output"];
};

export type UpdateWorkspacePayload = {
  __typename?: "UpdateWorkspacePayload";
  id: Scalars["ID"]["output"];
};

export type User = {
  __typename?: "User";
  accounts: AccountConnection;
  apiKey?: Maybe<UserApiKey>;
  apiKeys: UserApiKeyConnection;
  banExpiresAt?: Maybe<Scalars["DateTime"]["output"]>;
  banReason?: Maybe<Scalars["String"]["output"]>;
  banned: Scalars["Boolean"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  email: Scalars["String"]["output"];
  emailVerified: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  image?: Maybe<Scalars["String"]["output"]>;
  invitations: WorkspaceInvitationConnection;
  name: Scalars["String"]["output"];
  permissions: Array<UserPermission>;
  roles: Array<UserRole>;
  sessions: SessionConnection;
  updatedAt: Scalars["DateTime"]["output"];
  workspaces: WorkspaceConnection;
};

export type UserAccountsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["AccountFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<AccountOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type UserApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type UserApiKeysArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["UserApiKeyFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<UserApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type UserInvitationsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceInvitationFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceInvitationOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type UserSessionsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["SessionFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<SessionOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type UserWorkspacesArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type UserApiKey = {
  __typename?: "UserApiKey";
  createdAt: Scalars["DateTime"]["output"];
  createdById?: Maybe<Scalars["ID"]["output"]>;
  expiresAt?: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["ID"]["output"];
  lastUsedAt?: Maybe<Scalars["DateTime"]["output"]>;
  name: Scalars["String"]["output"];
  permissions: Array<UserApiKeyPermission>;
  prefix?: Maybe<Scalars["String"]["output"]>;
  revokedAt?: Maybe<Scalars["DateTime"]["output"]>;
  start?: Maybe<Scalars["String"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
  user?: Maybe<User>;
};

export type UserApiKeyConnection = {
  __typename?: "UserApiKeyConnection";
  /** A list of edges. */
  edges: Array<UserApiKeyEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

export type UserApiKeyEdge = {
  __typename?: "UserApiKeyEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of UserApiKeyEdge. */
  node: UserApiKey;
};

/** Ordering options for userapikey connections */
export type UserApiKeyOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order userapikeys by. */
  field: UserApiKeyOrderField;
};

/** Properties by which userapikey connections can be ordered. */
export const UserApiKeyOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
  LAST_USED_AT: "LAST_USED_AT",
  REVOKED_AT: "REVOKED_AT",
} as const;

export type UserApiKeyOrderField =
  (typeof UserApiKeyOrderField)[keyof typeof UserApiKeyOrderField];
export const UserApiKeyPermission = {
  SESSION__READ: "SESSION__READ",
  SESSION__REVOKE: "SESSION__REVOKE",
  SYSTEM_ACCOUNT_API_KEY__READ: "SYSTEM_ACCOUNT_API_KEY__READ",
  SYSTEM_ACCOUNT_API_KEY__WRITE: "SYSTEM_ACCOUNT_API_KEY__WRITE",
  SYSTEM_ACCOUNT__READ: "SYSTEM_ACCOUNT__READ",
  SYSTEM_ACCOUNT__WRITE: "SYSTEM_ACCOUNT__WRITE",
  USER_API_KEY__READ: "USER_API_KEY__READ",
  USER_API_KEY__WRITE: "USER_API_KEY__WRITE",
  USER__BAN: "USER__BAN",
  USER__CREATE: "USER__CREATE",
  USER__DELETE: "USER__DELETE",
  USER__IMPERSONATE: "USER__IMPERSONATE",
  USER__IMPERSONATE_ADMIN: "USER__IMPERSONATE_ADMIN",
  USER__READ: "USER__READ",
  USER__SET_EMAIL: "USER__SET_EMAIL",
  USER__SET_PASSWORD: "USER__SET_PASSWORD",
  USER__SET_PERMISSIONS: "USER__SET_PERMISSIONS",
  USER__SET_ROLES: "USER__SET_ROLES",
  USER__UPDATE: "USER__UPDATE",
  WORKSPACE_API_KEY__READ: "WORKSPACE_API_KEY__READ",
  WORKSPACE_API_KEY__WRITE: "WORKSPACE_API_KEY__WRITE",
  WORKSPACE_MEMBER__INVITE: "WORKSPACE_MEMBER__INVITE",
  WORKSPACE_MEMBER__READ: "WORKSPACE_MEMBER__READ",
  WORKSPACE_MEMBER__SET_PERMISSIONS: "WORKSPACE_MEMBER__SET_PERMISSIONS",
  WORKSPACE_MEMBER__SET_ROLES: "WORKSPACE_MEMBER__SET_ROLES",
  WORKSPACE_MEMBER__WRITE: "WORKSPACE_MEMBER__WRITE",
  WORKSPACE_SERVICE_ACCOUNT__READ: "WORKSPACE_SERVICE_ACCOUNT__READ",
  WORKSPACE_SERVICE_ACCOUNT__WRITE: "WORKSPACE_SERVICE_ACCOUNT__WRITE",
  WORKSPACE__CREATE: "WORKSPACE__CREATE",
  WORKSPACE__DELETE: "WORKSPACE__DELETE",
  WORKSPACE__DELETE_ANY: "WORKSPACE__DELETE_ANY",
  WORKSPACE__READ: "WORKSPACE__READ",
  WORKSPACE__READ_ANY: "WORKSPACE__READ_ANY",
  WORKSPACE__UPDATE: "WORKSPACE__UPDATE",
  WORKSPACE__UPDATE_ANY: "WORKSPACE__UPDATE_ANY",
} as const;

export type UserApiKeyPermission =
  (typeof UserApiKeyPermission)[keyof typeof UserApiKeyPermission];
export type UserApiKeyPermissionOption = {
  __typename?: "UserApiKeyPermissionOption";
  default: Scalars["Boolean"]["output"];
  grantable: Scalars["Boolean"]["output"];
  permission: UserApiKeyPermission;
};

export type UserConnection = {
  __typename?: "UserConnection";
  /** A list of edges. */
  edges: Array<UserEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

/** An auto-generated type which holds one User and a cursor during pagination. */
export type UserEdge = {
  __typename?: "UserEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of UserEdge. */
  node: User;
};

/** Ordering options for user connections */
export type UserOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order users by. */
  field: UserOrderField;
};

/** Properties by which user connections can be ordered. */
export const UserOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
} as const;

export type UserOrderField =
  (typeof UserOrderField)[keyof typeof UserOrderField];
export const UserPermission = {
  SESSION__READ: "SESSION__READ",
  SESSION__REVOKE: "SESSION__REVOKE",
  SYSTEM_ACCOUNT_API_KEY__READ: "SYSTEM_ACCOUNT_API_KEY__READ",
  SYSTEM_ACCOUNT_API_KEY__WRITE: "SYSTEM_ACCOUNT_API_KEY__WRITE",
  SYSTEM_ACCOUNT__READ: "SYSTEM_ACCOUNT__READ",
  SYSTEM_ACCOUNT__WRITE: "SYSTEM_ACCOUNT__WRITE",
  USER_API_KEY__READ: "USER_API_KEY__READ",
  USER_API_KEY__WRITE: "USER_API_KEY__WRITE",
  USER__BAN: "USER__BAN",
  USER__CREATE: "USER__CREATE",
  USER__DELETE: "USER__DELETE",
  USER__IMPERSONATE: "USER__IMPERSONATE",
  USER__IMPERSONATE_ADMIN: "USER__IMPERSONATE_ADMIN",
  USER__READ: "USER__READ",
  USER__SET_EMAIL: "USER__SET_EMAIL",
  USER__SET_PASSWORD: "USER__SET_PASSWORD",
  USER__SET_PERMISSIONS: "USER__SET_PERMISSIONS",
  USER__SET_ROLES: "USER__SET_ROLES",
  USER__UPDATE: "USER__UPDATE",
  WORKSPACE__CREATE: "WORKSPACE__CREATE",
  WORKSPACE__DELETE_ANY: "WORKSPACE__DELETE_ANY",
  WORKSPACE__READ_ANY: "WORKSPACE__READ_ANY",
  WORKSPACE__UPDATE_ANY: "WORKSPACE__UPDATE_ANY",
} as const;

export type UserPermission =
  (typeof UserPermission)[keyof typeof UserPermission];
export type UserPermissionOption = {
  __typename?: "UserPermissionOption";
  grantable: Scalars["Boolean"]["output"];
  permission: UserPermission;
};

export const UserRole = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export type UserRoleOption = {
  __typename?: "UserRoleOption";
  grantable: Scalars["Boolean"]["output"];
  role: UserRole;
};

export type Workspace = {
  __typename?: "Workspace";
  apiKey?: Maybe<WorkspaceApiKey>;
  createdAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  invitations: WorkspaceInvitationConnection;
  members: WorkspaceMemberConnection;
  name: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type WorkspaceApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type WorkspaceInvitationsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceInvitationFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceInvitationOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type WorkspaceMembersArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceMemberFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceMemberOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type WorkspaceApiKey = {
  __typename?: "WorkspaceApiKey";
  createdAt: Scalars["DateTime"]["output"];
  createdById?: Maybe<Scalars["ID"]["output"]>;
  expiresAt?: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["ID"]["output"];
  lastUsedAt?: Maybe<Scalars["DateTime"]["output"]>;
  member?: Maybe<WorkspaceMember>;
  name: Scalars["String"]["output"];
  permissions: Array<WorkspaceApiKeyPermission>;
  prefix?: Maybe<Scalars["String"]["output"]>;
  revokedAt?: Maybe<Scalars["DateTime"]["output"]>;
  start?: Maybe<Scalars["String"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
};

export type WorkspaceApiKeyConnection = {
  __typename?: "WorkspaceApiKeyConnection";
  /** A list of edges. */
  edges: Array<WorkspaceApiKeyEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

export type WorkspaceApiKeyEdge = {
  __typename?: "WorkspaceApiKeyEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of WorkspaceApiKeyEdge. */
  node: WorkspaceApiKey;
};

/** Ordering options for workspaceapikey connections */
export type WorkspaceApiKeyOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order workspaceapikeys by. */
  field: WorkspaceApiKeyOrderField;
};

/** Properties by which workspaceapikey connections can be ordered. */
export const WorkspaceApiKeyOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
  LAST_USED_AT: "LAST_USED_AT",
  REVOKED_AT: "REVOKED_AT",
} as const;

export type WorkspaceApiKeyOrderField =
  (typeof WorkspaceApiKeyOrderField)[keyof typeof WorkspaceApiKeyOrderField];
export const WorkspaceApiKeyPermission = {
  WORKSPACE_API_KEY__READ: "WORKSPACE_API_KEY__READ",
  WORKSPACE_API_KEY__WRITE: "WORKSPACE_API_KEY__WRITE",
  WORKSPACE_MEMBER__INVITE: "WORKSPACE_MEMBER__INVITE",
  WORKSPACE_MEMBER__READ: "WORKSPACE_MEMBER__READ",
  WORKSPACE_MEMBER__SET_PERMISSIONS: "WORKSPACE_MEMBER__SET_PERMISSIONS",
  WORKSPACE_MEMBER__SET_ROLES: "WORKSPACE_MEMBER__SET_ROLES",
  WORKSPACE_MEMBER__WRITE: "WORKSPACE_MEMBER__WRITE",
  WORKSPACE_SERVICE_ACCOUNT__READ: "WORKSPACE_SERVICE_ACCOUNT__READ",
  WORKSPACE_SERVICE_ACCOUNT__WRITE: "WORKSPACE_SERVICE_ACCOUNT__WRITE",
  WORKSPACE__DELETE: "WORKSPACE__DELETE",
  WORKSPACE__READ: "WORKSPACE__READ",
  WORKSPACE__UPDATE: "WORKSPACE__UPDATE",
} as const;

export type WorkspaceApiKeyPermission =
  (typeof WorkspaceApiKeyPermission)[keyof typeof WorkspaceApiKeyPermission];
export type WorkspaceApiKeyPermissionOption = {
  __typename?: "WorkspaceApiKeyPermissionOption";
  default: Scalars["Boolean"]["output"];
  grantable: Scalars["Boolean"]["output"];
  permission: WorkspaceApiKeyPermission;
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

export type WorkspaceInvitation = {
  __typename?: "WorkspaceInvitation";
  createdAt: Scalars["DateTime"]["output"];
  email: Scalars["String"]["output"];
  expiresAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  inviter: User;
  roles: Array<WorkspaceRole>;
  status: WorkspaceInvitationStatus;
  workspace: Workspace;
  workspaceId: Scalars["ID"]["output"];
};

export type WorkspaceInvitationConnection = {
  __typename?: "WorkspaceInvitationConnection";
  /** A list of edges. */
  edges: Array<WorkspaceInvitationEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

/** An auto-generated type which holds one WorkspaceInvitation and a cursor during pagination. */
export type WorkspaceInvitationEdge = {
  __typename?: "WorkspaceInvitationEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of WorkspaceInvitationEdge. */
  node: WorkspaceInvitation;
};

/** Ordering options for workspaceinvitation connections */
export type WorkspaceInvitationOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order workspaceinvitations by. */
  field: WorkspaceInvitationOrderField;
};

/** Properties by which workspaceinvitation connections can be ordered. */
export const WorkspaceInvitationOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
} as const;

export type WorkspaceInvitationOrderField =
  (typeof WorkspaceInvitationOrderField)[keyof typeof WorkspaceInvitationOrderField];
export const WorkspaceInvitationStatus = {
  ACCEPTED: "ACCEPTED",
  CANCELED: "CANCELED",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
} as const;

export type WorkspaceInvitationStatus =
  (typeof WorkspaceInvitationStatus)[keyof typeof WorkspaceInvitationStatus];
export type WorkspaceMember = {
  __typename?: "WorkspaceMember";
  apiKeys: WorkspaceApiKeyConnection;
  createdAt: Scalars["DateTime"]["output"];
  email?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  permissions: Array<WorkspacePermission>;
  roles: Array<WorkspaceRole>;
  status: WorkspaceMemberStatus;
  type: WorkspaceMemberType;
  updatedAt: Scalars["DateTime"]["output"];
  user?: Maybe<User>;
  workspaceId: Scalars["ID"]["output"];
};

export type WorkspaceMemberApiKeysArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceApiKeyFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
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
export const WorkspaceMemberOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
} as const;

export type WorkspaceMemberOrderField =
  (typeof WorkspaceMemberOrderField)[keyof typeof WorkspaceMemberOrderField];
export const WorkspaceMemberStatus = {
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
} as const;

export type WorkspaceMemberStatus =
  (typeof WorkspaceMemberStatus)[keyof typeof WorkspaceMemberStatus];
export const WorkspaceMemberType = {
  SERVICE_ACCOUNT: "SERVICE_ACCOUNT",
  USER: "USER",
} as const;

export type WorkspaceMemberType =
  (typeof WorkspaceMemberType)[keyof typeof WorkspaceMemberType];
/** Ordering options for workspace connections */
export type WorkspaceOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order workspaces by. */
  field: WorkspaceOrderField;
};

/** Properties by which workspace connections can be ordered. */
export const WorkspaceOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
} as const;

export type WorkspaceOrderField =
  (typeof WorkspaceOrderField)[keyof typeof WorkspaceOrderField];
export const WorkspacePermission = {
  WORKSPACE_API_KEY__READ: "WORKSPACE_API_KEY__READ",
  WORKSPACE_API_KEY__WRITE: "WORKSPACE_API_KEY__WRITE",
  WORKSPACE_MEMBER__INVITE: "WORKSPACE_MEMBER__INVITE",
  WORKSPACE_MEMBER__READ: "WORKSPACE_MEMBER__READ",
  WORKSPACE_MEMBER__SET_PERMISSIONS: "WORKSPACE_MEMBER__SET_PERMISSIONS",
  WORKSPACE_MEMBER__SET_ROLES: "WORKSPACE_MEMBER__SET_ROLES",
  WORKSPACE_MEMBER__WRITE: "WORKSPACE_MEMBER__WRITE",
  WORKSPACE_SERVICE_ACCOUNT__READ: "WORKSPACE_SERVICE_ACCOUNT__READ",
  WORKSPACE_SERVICE_ACCOUNT__WRITE: "WORKSPACE_SERVICE_ACCOUNT__WRITE",
  WORKSPACE__DELETE: "WORKSPACE__DELETE",
  WORKSPACE__READ: "WORKSPACE__READ",
  WORKSPACE__UPDATE: "WORKSPACE__UPDATE",
} as const;

export type WorkspacePermission =
  (typeof WorkspacePermission)[keyof typeof WorkspacePermission];
export type WorkspacePermissionOption = {
  __typename?: "WorkspacePermissionOption";
  grantable: Scalars["Boolean"]["output"];
  permission: WorkspacePermission;
};

export const WorkspaceRole = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
  OWNER: "OWNER",
} as const;

export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];
export type WorkspaceRoleOption = {
  __typename?: "WorkspaceRoleOption";
  grantable: Scalars["Boolean"]["output"];
  role: WorkspaceRole;
};

export type SystemApiKeysQueryVariables = Exact<{
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  query?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["SystemApiKeyFilter"]["input"]>;
  orderBy?: InputMaybe<SystemApiKeyOrder>;
}>;

export type SystemApiKeysQuery = {
  __typename?: "Query";
  systemApiKeys: {
    __typename?: "SystemApiKeyConnection";
    edges: Array<{
      __typename?: "SystemApiKeyEdge";
      node: {
        __typename?: "SystemApiKey";
        id: string;
        name: string;
        revokedAt?: any | null;
        permissions: Array<SystemApiKeyPermission>;
        prefix?: string | null;
        start?: string | null;
        createdAt: any;
        lastUsedAt?: any | null;
        expiresAt?: any | null;
        systemAccount?: {
          __typename: "SystemAccount";
          id: string;
          name: string;
        } | null;
      };
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

export type GetAdminOverviewQueryVariables = Exact<{
  includeUsers?: Scalars["Boolean"]["input"];
}>;

export type GetAdminOverviewQuery = {
  __typename?: "Query";
  users?: {
    __typename?: "UserConnection";
    totalCount: number;
    totalCountRelation: TotalCountRelation;
  };
};

export type GetAdminSystemAccountOverviewQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetAdminSystemAccountOverviewQuery = {
  __typename?: "Query";
  systemAccounts: {
    __typename?: "SystemAccountConnection";
    totalCount: number;
    totalCountRelation: TotalCountRelation;
  };
};

export type GetAdminSystemKeyOverviewQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetAdminSystemKeyOverviewQuery = {
  __typename?: "Query";
  systemApiKeys: {
    __typename?: "SystemApiKeyConnection";
    totalCount: number;
    totalCountRelation: TotalCountRelation;
  };
};

export type ManagedSystemAccountsQueryVariables = Exact<{
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  query?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["SystemAccountFilter"]["input"]>;
  orderBy?: InputMaybe<SystemAccountOrder>;
}>;

export type ManagedSystemAccountsQuery = {
  __typename?: "Query";
  systemAccounts: {
    __typename?: "SystemAccountConnection";
    totalCount: number;
    edges: Array<{
      __typename?: "SystemAccountEdge";
      node: {
        __typename?: "SystemAccount";
        id: string;
        name: string;
        enabled: boolean;
        permissions: Array<SystemAccountPermission>;
        createdAt: any;
      };
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

export type GetAdminUserNeighborsQueryVariables = Exact<{
  cursor: Scalars["String"]["input"];
  query?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["UserFilter"]["input"]>;
  orderBy?: InputMaybe<UserOrder>;
}>;

export type GetAdminUserNeighborsQuery = {
  __typename?: "Query";
  previous: {
    __typename?: "UserConnection";
    edges: Array<{
      __typename?: "UserEdge";
      cursor: string;
      node: { __typename?: "User"; id: string };
    }>;
  };
  next: {
    __typename?: "UserConnection";
    edges: Array<{
      __typename?: "UserEdge";
      cursor: string;
      node: { __typename?: "User"; id: string };
    }>;
  };
};

export type GetUserFromUserRouteQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
  sessionsAfter?: InputMaybe<Scalars["String"]["input"]>;
  includeSessions?: Scalars["Boolean"]["input"];
  includeRoles?: Scalars["Boolean"]["input"];
  includePermissions?: Scalars["Boolean"]["input"];
}>;

export type GetUserFromUserRouteQuery = {
  __typename?: "Query";
  user?: {
    __typename?: "User";
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    roles: Array<UserRole>;
    permissions: Array<UserPermission>;
    banned: boolean;
    banReason?: string | null;
    banExpiresAt?: any | null;
    createdAt: any;
    updatedAt: any;
    sessions?: {
      __typename?: "SessionConnection";
      pageInfo: {
        __typename?: "PageInfo";
        hasNextPage: boolean;
        endCursor?: string | null;
      };
      edges: Array<{
        __typename?: "SessionEdge";
        node: {
          __typename?: "Session";
          id: string;
          expiresAt: any;
          ipAddress?: string | null;
          userAgent?: string | null;
          createdAt: any;
        };
      }>;
    };
  } | null;
  userRoles?: Array<{
    __typename?: "UserRoleOption";
    role: UserRole;
    grantable: boolean;
  }>;
  userPermissions?: Array<{
    __typename?: "UserPermissionOption";
    permission: UserPermission;
    grantable: boolean;
  }>;
};

export type UpdateManagedUserFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateUserInput;
}>;

export type UpdateManagedUserFromUserRouteMutation = {
  __typename?: "Mutation";
  updateUser: { __typename?: "UpdateUserPayload"; id: string };
};

export type SetUserPermissionsFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: SetUserPermissionsInput;
}>;

export type SetUserPermissionsFromUserRouteMutation = {
  __typename?: "Mutation";
  setUserPermissions: { __typename?: "SetUserPermissionsPayload"; id: string };
};

export type SetUserRolesFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: SetUserRolesInput;
}>;

export type SetUserRolesFromUserRouteMutation = {
  __typename?: "Mutation";
  setUserRoles: { __typename?: "SetUserRolesPayload"; id: string };
};

export type BanUserFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input?: InputMaybe<BanUserInput>;
}>;

export type BanUserFromUserRouteMutation = {
  __typename?: "Mutation";
  banUser: { __typename?: "BanUserPayload"; id: string };
};

export type UnbanUserFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type UnbanUserFromUserRouteMutation = {
  __typename?: "Mutation";
  unbanUser: { __typename?: "UnbanUserPayload"; id: string };
};

export type SetUserPasswordFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: SetUserPasswordInput;
}>;

export type SetUserPasswordFromUserRouteMutation = {
  __typename?: "Mutation";
  setUserPassword: boolean;
};

export type RevokeUserSessionFromUserRouteMutationVariables = Exact<{
  userId: Scalars["ID"]["input"];
  id: Scalars["ID"]["input"];
}>;

export type RevokeUserSessionFromUserRouteMutation = {
  __typename?: "Mutation";
  revokeSession: boolean;
};

export type RevokeUserSessionsFromUserRouteMutationVariables = Exact<{
  userId: Scalars["ID"]["input"];
}>;

export type RevokeUserSessionsFromUserRouteMutation = {
  __typename?: "Mutation";
  revokeUserSessions: boolean;
};

export type DeleteUserFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DeleteUserFromUserRouteMutation = {
  __typename?: "Mutation";
  deleteUser: { __typename?: "DeleteUserPayload"; id: string };
};

export type ImpersonateUserFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type ImpersonateUserFromUserRouteMutation = {
  __typename?: "Mutation";
  impersonateUser: { __typename?: "User"; id: string };
};

export type CreateUserFromCreateUserRouteMutationVariables = Exact<{
  input: CreateUserInput;
}>;

export type CreateUserFromCreateUserRouteMutation = {
  __typename?: "Mutation";
  createUser: { __typename?: "CreateUserPayload"; id: string };
};

export type GetUsersFromUsersRouteQueryVariables = Exact<{
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["UserFilter"]["input"]>;
  query?: InputMaybe<Scalars["String"]["input"]>;
  orderBy?: InputMaybe<UserOrder>;
}>;

export type GetUsersFromUsersRouteQuery = {
  __typename?: "Query";
  users: {
    __typename?: "UserConnection";
    totalCount: number;
    edges: Array<{
      __typename?: "UserEdge";
      node: {
        __typename?: "User";
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        banned: boolean;
        createdAt: any;
      };
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

export type SignOutFromSidebarUserMutationVariables = Exact<{
  [key: string]: never;
}>;

export type SignOutFromSidebarUserMutation = {
  __typename?: "Mutation";
  signOut: boolean;
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
  currentUser: {
    __typename?: "User";
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
};

export type GetCurrentUserFromAuthenticatedRouteQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetCurrentUserFromAuthenticatedRouteQuery = {
  __typename?: "Query";
  currentUser: {
    __typename?: "User";
    id: string;
    name: string;
    email: string;
    permissions: Array<UserPermission>;
  };
  currentSession?: {
    __typename?: "Session";
    impersonatedById?: string | null;
  } | null;
  currentAbilityRules: Array<{
    __typename?: "AuthAbilityRuleType";
    actions: Array<string>;
    subjects: Array<string>;
    fields?: Array<string> | null;
    conditions?: Record<string, unknown> | null;
    inverted: boolean;
    reason?: string | null;
  }>;
};

export type StopImpersonatingFromAuthenticatedRouteMutationVariables = Exact<{
  [key: string]: never;
}>;

export type StopImpersonatingFromAuthenticatedRouteMutation = {
  __typename?: "Mutation";
  stopImpersonating?: { __typename?: "User"; id: string } | null;
};

export type DeleteUserApiKeyFromUserApiKeysRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DeleteUserApiKeyFromUserApiKeysRouteMutation = {
  __typename?: "Mutation";
  deleteUserApiKey: {
    __typename?: "UserApiKey";
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    revokedAt?: any | null;
    permissions: Array<UserApiKeyPermission>;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
  };
};

export type GetUserApiKeyDetailsQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type GetUserApiKeyDetailsQuery = {
  __typename?: "Query";
  userApiKeyPermissions: Array<{
    __typename?: "UserApiKeyPermissionOption";
    permission: UserApiKeyPermission;
    grantable: boolean;
    default: boolean;
  }>;
  currentUser: {
    __typename?: "User";
    apiKey?: {
      __typename?: "UserApiKey";
      id: string;
      name: string;
      start?: string | null;
      prefix?: string | null;
      revokedAt?: any | null;
      permissions: Array<UserApiKeyPermission>;
      createdAt: any;
      lastUsedAt?: any | null;
      expiresAt?: any | null;
    } | null;
  };
};

export type GetUserApiKeyNeighborsQueryVariables = Exact<{
  cursor: Scalars["String"]["input"];
  filter?: InputMaybe<Scalars["UserApiKeyFilter"]["input"]>;
  orderBy?: InputMaybe<UserApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetUserApiKeyNeighborsQuery = {
  __typename?: "Query";
  currentUser: {
    __typename?: "User";
    id: string;
    previous: {
      __typename?: "UserApiKeyConnection";
      edges: Array<{
        __typename?: "UserApiKeyEdge";
        cursor: string;
        node: { __typename?: "UserApiKey"; id: string };
      }>;
    };
    next: {
      __typename?: "UserApiKeyConnection";
      edges: Array<{
        __typename?: "UserApiKeyEdge";
        cursor: string;
        node: { __typename?: "UserApiKey"; id: string };
      }>;
    };
  };
};

export type CreateUserApiKeyFromUserApiKeysRouteMutationVariables = Exact<{
  input: CreateUserApiKeyInput;
}>;

export type CreateUserApiKeyFromUserApiKeysRouteMutation = {
  __typename?: "Mutation";
  createUserApiKey: {
    __typename?: "CreateUserApiKeyResult";
    apiKey: string;
    entity: {
      __typename?: "UserApiKey";
      id: string;
      name: string;
      start?: string | null;
      prefix?: string | null;
      revokedAt?: any | null;
      permissions: Array<UserApiKeyPermission>;
      createdAt: any;
      lastUsedAt?: any | null;
      expiresAt?: any | null;
    };
  };
};

export type GetUserApiKeyOptionsQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetUserApiKeyOptionsQuery = {
  __typename?: "Query";
  userApiKeyPermissions: Array<{
    __typename?: "UserApiKeyPermissionOption";
    permission: UserApiKeyPermission;
    grantable: boolean;
    default: boolean;
  }>;
};

export type GetUserApiKeysFromUserApiKeysRouteQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  filter?: InputMaybe<Scalars["UserApiKeyFilter"]["input"]>;
  orderBy?: InputMaybe<UserApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetUserApiKeysFromUserApiKeysRouteQuery = {
  __typename?: "Query";
  currentUser: {
    __typename?: "User";
    apiKeys: {
      __typename?: "UserApiKeyConnection";
      edges: Array<{
        __typename?: "UserApiKeyEdge";
        node: {
          __typename?: "UserApiKey";
          id: string;
          name: string;
          start?: string | null;
          prefix?: string | null;
          revokedAt?: any | null;
          permissions: Array<UserApiKeyPermission>;
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
};

export type GetUserOverviewQueryVariables = Exact<{
  includeApiKeys: Scalars["Boolean"]["input"];
}>;

export type GetUserOverviewQuery = {
  __typename?: "Query";
  currentUser: {
    __typename?: "User";
    id: string;
    workspaces: {
      __typename?: "WorkspaceConnection";
      totalCount: number;
      totalCountRelation: TotalCountRelation;
    };
    sessions: {
      __typename?: "SessionConnection";
      totalCount: number;
      totalCountRelation: TotalCountRelation;
    };
    apiKeys?: {
      __typename?: "UserApiKeyConnection";
      totalCount: number;
      totalCountRelation: TotalCountRelation;
    };
  };
};

export type UpdateUserFromUserRouteMutationVariables = Exact<{
  input: AuthUpdateUserInput;
}>;

export type UpdateUserFromUserRouteMutation = {
  __typename?: "Mutation";
  updateCurrentUser: boolean;
};

export type ChangeEmailFromUserRouteMutationVariables = Exact<{
  input: AuthChangeEmailInput;
}>;

export type ChangeEmailFromUserRouteMutation = {
  __typename?: "Mutation";
  changeCurrentUserEmail: boolean;
};

export type ChangePasswordFromUserSecurityMutationVariables = Exact<{
  input: AuthChangePasswordInput;
}>;

export type ChangePasswordFromUserSecurityMutation = {
  __typename?: "Mutation";
  changeCurrentUserPassword: {
    __typename?: "AuthChangePasswordResultType";
    token?: string | null;
  };
};

export type GetSessionsFromUserSecurityQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetSessionsFromUserSecurityQuery = {
  __typename?: "Query";
  currentUser: {
    __typename?: "User";
    id: string;
    sessions: {
      __typename?: "SessionConnection";
      pageInfo: {
        __typename?: "PageInfo";
        hasNextPage: boolean;
        endCursor?: string | null;
      };
      edges: Array<{
        __typename?: "SessionEdge";
        node: {
          __typename?: "Session";
          id: string;
          current: boolean;
          expiresAt: any;
          ipAddress?: string | null;
          userAgent?: string | null;
          createdAt: any;
        };
      }>;
    };
  };
};

export type RevokeSessionFromUserSecurityMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type RevokeSessionFromUserSecurityMutation = {
  __typename?: "Mutation";
  revokeCurrentUserSession: boolean;
};

export type RevokeOtherSessionsFromUserSecurityMutationVariables = Exact<{
  [key: string]: never;
}>;

export type RevokeOtherSessionsFromUserSecurityMutation = {
  __typename?: "Mutation";
  revokeCurrentUserOtherSessions: boolean;
};

export type GetAccountsFromUserSecurityQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetAccountsFromUserSecurityQuery = {
  __typename?: "Query";
  currentUser: {
    __typename?: "User";
    id: string;
    accounts: {
      __typename?: "AccountConnection";
      totalCount: number;
      pageInfo: {
        __typename?: "PageInfo";
        hasNextPage: boolean;
        endCursor?: string | null;
      };
      edges: Array<{
        __typename?: "AccountEdge";
        node: {
          __typename?: "Account";
          id: string;
          accountId: string;
          issuer: string;
          providerId: string;
          scopes: Array<string>;
          createdAt: any;
        };
      }>;
    };
  };
};

export type GetSocialProvidersFromUserSecurityQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetSocialProvidersFromUserSecurityQuery = {
  __typename?: "Query";
  socialProviders: Array<{
    __typename?: "AuthSocialProviderType";
    id: string;
    name: string;
  }>;
};

export type UnlinkAccountFromUserSecurityMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type UnlinkAccountFromUserSecurityMutation = {
  __typename?: "Mutation";
  unlinkCurrentUserAccount: boolean;
};

export type LinkAccountFromUserSecurityMutationVariables = Exact<{
  input: AuthLinkSocialAccountInput;
}>;

export type LinkAccountFromUserSecurityMutation = {
  __typename?: "Mutation";
  linkCurrentUserAccount: {
    __typename?: "AuthLinkSocialAccountResultType";
    url: string;
    redirect: boolean;
  };
};

export type DeleteUserFromUserSecurityMutationVariables = Exact<{
  input?: InputMaybe<AuthDeleteUserInput>;
}>;

export type DeleteUserFromUserSecurityMutation = {
  __typename?: "Mutation";
  deleteCurrentUser: {
    __typename?: "AuthDeleteUserResultType";
    success: boolean;
    message: string;
  };
};

export type CreateWorkspaceFromCreateWorkspaceRouteMutationVariables = Exact<{
  input: CreateWorkspaceInput;
}>;

export type CreateWorkspaceFromCreateWorkspaceRouteMutation = {
  __typename?: "Mutation";
  createWorkspace: { __typename?: "CreateWorkspacePayload"; id: string };
};

export type GetWorkspacesFromUserWorkspacesRouteQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceFilter"]["input"]>;
  invitationFirst?: InputMaybe<Scalars["Int"]["input"]>;
  invitationLast?: InputMaybe<Scalars["Int"]["input"]>;
  invitationAfter?: InputMaybe<Scalars["String"]["input"]>;
  invitationBefore?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetWorkspacesFromUserWorkspacesRouteQuery = {
  __typename?: "Query";
  currentUser: {
    __typename?: "User";
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
    invitations: {
      __typename?: "WorkspaceInvitationConnection";
      edges: Array<{
        __typename?: "WorkspaceInvitationEdge";
        node: {
          __typename?: "WorkspaceInvitation";
          workspaceId: string;
          id: string;
          roles: Array<WorkspaceRole>;
          expiresAt: any;
          workspace: { __typename?: "Workspace"; id: string; name: string };
        };
      }>;
      pageInfo: {
        __typename?: "PageInfo";
        endCursor?: string | null;
        startCursor?: string | null;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };
  };
};

export type AcceptWorkspaceInvitationFromUserWorkspacesRouteMutationVariables =
  Exact<{
    id: Scalars["ID"]["input"];
  }>;

export type AcceptWorkspaceInvitationFromUserWorkspacesRouteMutation = {
  __typename?: "Mutation";
  acceptWorkspaceInvitation: {
    __typename?: "AcceptWorkspaceInvitationPayload";
    id: string;
  };
};

export type RejectWorkspaceInvitationFromUserWorkspacesRouteMutationVariables =
  Exact<{
    id: Scalars["ID"]["input"];
  }>;

export type RejectWorkspaceInvitationFromUserWorkspacesRouteMutation = {
  __typename?: "Mutation";
  rejectWorkspaceInvitation: {
    __typename?: "RejectWorkspaceInvitationPayload";
    id: string;
  };
};

export type DeleteWorkspaceApiKeyMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DeleteWorkspaceApiKeyMutation = {
  __typename?: "Mutation";
  deleteWorkspaceApiKey: {
    __typename?: "WorkspaceApiKey";
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    revokedAt?: any | null;
    permissions: Array<WorkspaceApiKeyPermission>;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
  };
};

export type GetWorkspaceApiKeyDetailsQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type GetWorkspaceApiKeyDetailsQuery = {
  __typename?: "Query";
  workspaceApiKeyPermissions: Array<{
    __typename?: "WorkspaceApiKeyPermissionOption";
    permission: WorkspaceApiKeyPermission;
    grantable: boolean;
    default: boolean;
  }>;
  currentWorkspace?: {
    __typename?: "Workspace";
    apiKey?: {
      __typename?: "WorkspaceApiKey";
      id: string;
      name: string;
      start?: string | null;
      prefix?: string | null;
      revokedAt?: any | null;
      permissions: Array<WorkspaceApiKeyPermission>;
      createdAt: any;
      lastUsedAt?: any | null;
      expiresAt?: any | null;
      member?: {
        __typename: "WorkspaceMember";
        id: string;
        name: string;
      } | null;
    } | null;
  } | null;
};

export type GetWorkspaceApiKeyNeighborsQueryVariables = Exact<{
  cursor: Scalars["String"]["input"];
  filter?: InputMaybe<Scalars["WorkspaceApiKeyFilter"]["input"]>;
  orderBy?: InputMaybe<WorkspaceApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetWorkspaceApiKeyNeighborsQuery = {
  __typename?: "Query";
  currentWorkspace?: { __typename?: "Workspace"; id: string } | null;
  previous: {
    __typename?: "WorkspaceApiKeyConnection";
    edges: Array<{
      __typename?: "WorkspaceApiKeyEdge";
      cursor: string;
      node: { __typename?: "WorkspaceApiKey"; id: string };
    }>;
  };
  next: {
    __typename?: "WorkspaceApiKeyConnection";
    edges: Array<{
      __typename?: "WorkspaceApiKeyEdge";
      cursor: string;
      node: { __typename?: "WorkspaceApiKey"; id: string };
    }>;
  };
};

export type CreateWorkspaceApiKeyMutationVariables = Exact<{
  input: CreateWorkspaceApiKeyInput;
}>;

export type CreateWorkspaceApiKeyMutation = {
  __typename?: "Mutation";
  createWorkspaceApiKey: {
    __typename?: "CreateWorkspaceApiKeyResult";
    apiKey: string;
    entity: {
      __typename?: "WorkspaceApiKey";
      id: string;
      name: string;
      start?: string | null;
      prefix?: string | null;
      revokedAt?: any | null;
      permissions: Array<WorkspaceApiKeyPermission>;
      createdAt: any;
      lastUsedAt?: any | null;
      expiresAt?: any | null;
    };
  };
};

export type GetWorkspaceApiKeyOptionsQueryVariables = Exact<{
  includeWorkspaceMembers?: Scalars["Boolean"]["input"];
  after?: InputMaybe<Scalars["String"]["input"]>;
  memberFilter?: InputMaybe<Scalars["WorkspaceMemberFilter"]["input"]>;
}>;

export type GetWorkspaceApiKeyOptionsQuery = {
  __typename?: "Query";
  currentWorkspace?: {
    __typename?: "Workspace";
    members: {
      __typename?: "WorkspaceMemberConnection";
      edges: Array<{
        __typename?: "WorkspaceMemberEdge";
        node: { __typename?: "WorkspaceMember"; id: string; name: string };
      }>;
      pageInfo: {
        __typename?: "PageInfo";
        endCursor?: string | null;
        hasNextPage: boolean;
      };
    };
  } | null;
  workspaceApiKeyPermissions: Array<{
    __typename?: "WorkspaceApiKeyPermissionOption";
    permission: WorkspaceApiKeyPermission;
    grantable: boolean;
    default: boolean;
  }>;
};

export type GetApiKeysFromApiKeysRouteQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceApiKeyFilter"]["input"]>;
  orderBy?: InputMaybe<WorkspaceApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type GetApiKeysFromApiKeysRouteQuery = {
  __typename?: "Query";
  workspaceApiKeys: {
    __typename?: "WorkspaceApiKeyConnection";
    edges: Array<{
      __typename?: "WorkspaceApiKeyEdge";
      node: {
        __typename?: "WorkspaceApiKey";
        id: string;
        name: string;
        start?: string | null;
        prefix?: string | null;
        revokedAt?: any | null;
        permissions: Array<WorkspaceApiKeyPermission>;
        createdAt: any;
        lastUsedAt?: any | null;
        expiresAt?: any | null;
        member?: {
          __typename: "WorkspaceMember";
          id: string;
          name: string;
          type: WorkspaceMemberType;
          workspaceId: string;
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
};

export type GetCurrentWorkspaceFromWorkspaceLayoutQueryVariables = Exact<{
  workspaceId: Scalars["ID"]["input"];
}>;

export type GetCurrentWorkspaceFromWorkspaceLayoutQuery = {
  __typename?: "Query";
  workspace?: {
    __typename?: "Workspace";
    id: string;
    name: string;
    createdAt: any;
    updatedAt: any;
  } | null;
  currentWorkspaceMember?: {
    __typename?: "WorkspaceMember";
    workspaceId: string;
    id: string;
    roles: Array<WorkspaceRole>;
    permissions: Array<WorkspacePermission>;
    type: WorkspaceMemberType;
    status: WorkspaceMemberStatus;
    name: string;
    email?: string | null;
  } | null;
  currentAbilityRules: Array<{
    __typename?: "AuthAbilityRuleType";
    actions: Array<string>;
    subjects: Array<string>;
    fields?: Array<string> | null;
    conditions?: Record<string, unknown> | null;
    inverted: boolean;
    reason?: string | null;
  }>;
};

export type SetWorkspaceMemberPermissionsFromWorkspaceMemberRouteMutationVariables =
  Exact<{
    id: Scalars["ID"]["input"];
    input: SetWorkspaceMemberPermissionsInput;
  }>;

export type SetWorkspaceMemberPermissionsFromWorkspaceMemberRouteMutation = {
  __typename?: "Mutation";
  setWorkspaceMemberPermissions: {
    __typename?: "SetWorkspaceMemberPermissionsPayload";
    id: string;
  };
};

export type UpdateWorkspaceMemberFromWorkspaceMemberRouteMutationVariables =
  Exact<{
    id: Scalars["ID"]["input"];
    input: UpdateWorkspaceMemberInput;
  }>;

export type UpdateWorkspaceMemberFromWorkspaceMemberRouteMutation = {
  __typename?: "Mutation";
  updateWorkspaceMember?: {
    __typename?: "UpdateWorkspaceMemberPayload";
    id: string;
  } | null;
};

export type SetWorkspaceMemberRolesFromWorkspaceMemberRouteMutationVariables =
  Exact<{
    id: Scalars["ID"]["input"];
    input: SetWorkspaceMemberRolesInput;
  }>;

export type SetWorkspaceMemberRolesFromWorkspaceMemberRouteMutation = {
  __typename?: "Mutation";
  setWorkspaceMemberRoles: {
    __typename?: "SetWorkspaceMemberRolesPayload";
    id: string;
  };
};

export type GetWorkspaceMemberNeighborsQueryVariables = Exact<{
  cursor: Scalars["String"]["input"];
  query?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceMemberFilter"]["input"]>;
  orderBy?: InputMaybe<WorkspaceMemberOrder>;
}>;

export type GetWorkspaceMemberNeighborsQuery = {
  __typename?: "Query";
  currentWorkspace?: {
    __typename?: "Workspace";
    id: string;
    previous: {
      __typename?: "WorkspaceMemberConnection";
      edges: Array<{
        __typename?: "WorkspaceMemberEdge";
        cursor: string;
        node: { __typename?: "WorkspaceMember"; id: string };
      }>;
    };
    next: {
      __typename?: "WorkspaceMemberConnection";
      edges: Array<{
        __typename?: "WorkspaceMemberEdge";
        cursor: string;
        node: { __typename?: "WorkspaceMember"; id: string };
      }>;
    };
  } | null;
};

export type GetWorkspaceMemberFromWorkspaceMemberRouteQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type GetWorkspaceMemberFromWorkspaceMemberRouteQuery = {
  __typename?: "Query";
  workspaceMember?: {
    __typename?: "WorkspaceMember";
    workspaceId: string;
    id: string;
    roles: Array<WorkspaceRole>;
    permissions: Array<WorkspacePermission>;
    type: WorkspaceMemberType;
    status: WorkspaceMemberStatus;
    name: string;
    email?: string | null;
    createdAt: any;
  } | null;
  workspaceRoles: Array<{
    __typename?: "WorkspaceRoleOption";
    role: WorkspaceRole;
    grantable: boolean;
  }>;
  workspacePermissions: Array<{
    __typename?: "WorkspacePermissionOption";
    permission: WorkspacePermission;
    grantable: boolean;
  }>;
};

export type RemoveWorkspaceMemberFromWorkspaceMemberRouteMutationVariables =
  Exact<{
    id: Scalars["ID"]["input"];
  }>;

export type RemoveWorkspaceMemberFromWorkspaceMemberRouteMutation = {
  __typename?: "Mutation";
  removeWorkspaceMember: {
    __typename?: "RemoveWorkspaceMemberPayload";
    id: string;
  };
};

export type UpdateWorkspaceMemberStatusFromWorkspaceMembersRouteMutationVariables =
  Exact<{
    id: Scalars["ID"]["input"];
    input: UpdateWorkspaceMemberInput;
  }>;

export type UpdateWorkspaceMemberStatusFromWorkspaceMembersRouteMutation = {
  __typename?: "Mutation";
  updateWorkspaceMember?: {
    __typename?: "UpdateWorkspaceMemberPayload";
    id: string;
  } | null;
};

export type GetWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRouteQueryVariables =
  Exact<{ [key: string]: never }>;

export type GetWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRouteQuery =
  {
    __typename?: "Query";
    workspaceRoles: Array<{
      __typename?: "WorkspaceRoleOption";
      role: WorkspaceRole;
      grantable: boolean;
    }>;
    workspacePermissions: Array<{
      __typename?: "WorkspacePermissionOption";
      permission: WorkspacePermission;
      grantable: boolean;
    }>;
  };

export type GetRolesFromInviteWorkspaceMemberRouteQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetRolesFromInviteWorkspaceMemberRouteQuery = {
  __typename?: "Query";
  workspaceRoles: Array<{
    __typename?: "WorkspaceRoleOption";
    role: WorkspaceRole;
    grantable: boolean;
  }>;
};

export type CreateWorkspaceInvitationFromInviteWorkspaceMemberRouteMutationVariables =
  Exact<{
    input: CreateWorkspaceInvitationInput;
  }>;

export type CreateWorkspaceInvitationFromInviteWorkspaceMemberRouteMutation = {
  __typename?: "Mutation";
  createWorkspaceInvitation: {
    __typename?: "CreateWorkspaceInvitationPayload";
    id: string;
  };
};

export type GetWorkspaceMembersFromWorkspaceMembersRouteQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceMemberFilter"]["input"]>;
  orderBy?: InputMaybe<WorkspaceMemberOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
  invitationFirst?: InputMaybe<Scalars["Int"]["input"]>;
  invitationLast?: InputMaybe<Scalars["Int"]["input"]>;
  invitationAfter?: InputMaybe<Scalars["String"]["input"]>;
  invitationBefore?: InputMaybe<Scalars["String"]["input"]>;
  invitationFilter?: InputMaybe<Scalars["WorkspaceInvitationFilter"]["input"]>;
  includeWorkspaceInvitations?: Scalars["Boolean"]["input"];
}>;

export type GetWorkspaceMembersFromWorkspaceMembersRouteQuery = {
  __typename?: "Query";
  currentWorkspace?: {
    __typename?: "Workspace";
    members: {
      __typename?: "WorkspaceMemberConnection";
      edges: Array<{
        __typename?: "WorkspaceMemberEdge";
        node: {
          __typename?: "WorkspaceMember";
          workspaceId: string;
          id: string;
          roles: Array<WorkspaceRole>;
          status: WorkspaceMemberStatus;
          type: WorkspaceMemberType;
          createdAt: any;
          name: string;
          email?: string | null;
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
    invitations?: {
      __typename?: "WorkspaceInvitationConnection";
      edges: Array<{
        __typename?: "WorkspaceInvitationEdge";
        node: {
          __typename?: "WorkspaceInvitation";
          workspaceId: string;
          id: string;
          email: string;
          roles: Array<WorkspaceRole>;
          status: WorkspaceInvitationStatus;
          expiresAt: any;
        };
      }>;
      pageInfo: {
        __typename?: "PageInfo";
        endCursor?: string | null;
        startCursor?: string | null;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };
  } | null;
};

export type CancelWorkspaceInvitationFromWorkspaceMembersRouteMutationVariables =
  Exact<{
    id: Scalars["ID"]["input"];
  }>;

export type CancelWorkspaceInvitationFromWorkspaceMembersRouteMutation = {
  __typename?: "Mutation";
  cancelWorkspaceInvitation: {
    __typename?: "CancelWorkspaceInvitationPayload";
    id: string;
  };
};

export type GetWorkspaceOverviewQueryVariables = Exact<{
  workspaceId: Scalars["ID"]["input"];
  includeWorkspaceMembers: Scalars["Boolean"]["input"];
  includeApiKeys: Scalars["Boolean"]["input"];
}>;

export type GetWorkspaceOverviewQuery = {
  __typename?: "Query";
  workspace?: {
    __typename?: "Workspace";
    id: string;
    members?: {
      __typename?: "WorkspaceMemberConnection";
      totalCount: number;
      totalCountRelation: TotalCountRelation;
    };
  } | null;
  workspaceApiKeys?: {
    __typename?: "WorkspaceApiKeyConnection";
    totalCount: number;
    totalCountRelation: TotalCountRelation;
  };
};

export type UpdateWorkspaceFromSettingsRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateWorkspaceInput;
}>;

export type UpdateWorkspaceFromSettingsRouteMutation = {
  __typename?: "Mutation";
  updateWorkspace: { __typename?: "UpdateWorkspacePayload"; id: string };
};

export type DeleteWorkspaceFromSettingsRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DeleteWorkspaceFromSettingsRouteMutation = {
  __typename?: "Mutation";
  deleteWorkspace: { __typename?: "DeleteWorkspacePayload"; id: string };
};

export type LeaveWorkspaceFromSettingsRouteMutationVariables = Exact<{
  [key: string]: never;
}>;

export type LeaveWorkspaceFromSettingsRouteMutation = {
  __typename?: "Mutation";
  leaveWorkspace: { __typename?: "LeaveWorkspacePayload"; memberId: string };
};

export type GetFirstWorkspaceFromWorkspacesRouteQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetFirstWorkspaceFromWorkspacesRouteQuery = {
  __typename?: "Query";
  currentUser: {
    __typename?: "User";
    workspaces: {
      __typename?: "WorkspaceConnection";
      edges: Array<{
        __typename?: "WorkspaceEdge";
        node: { __typename?: "Workspace"; id: string };
      }>;
    };
  };
};

export type SignInFromLoginFormMutationVariables = Exact<{
  input: AuthSignInInput;
}>;

export type SignInFromLoginFormMutation = {
  __typename?: "Mutation";
  signIn: {
    __typename?: "AuthSignInResultType";
    user: { __typename?: "User"; id: string };
  };
};

export type SignUpFromLoginFormMutationVariables = Exact<{
  input: AuthSignUpInput;
}>;

export type SignUpFromLoginFormMutation = {
  __typename?: "Mutation";
  signUp: { __typename?: "SignUpPayload"; id: string };
};

export type GetSocialProvidersFromLoginFormQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetSocialProvidersFromLoginFormQuery = {
  __typename?: "Query";
  socialProviders: Array<{
    __typename?: "AuthSocialProviderType";
    id: string;
    name: string;
  }>;
};

export type SignInSocialFromLoginFormMutationVariables = Exact<{
  input: AuthSignInSocialInput;
}>;

export type SignInSocialFromLoginFormMutation = {
  __typename?: "Mutation";
  signInSocial: {
    __typename?: "AuthSignInSocialResultType";
    redirect: boolean;
    url?: string | null;
  };
};

export type RequestPasswordResetFromForgotPasswordMutationVariables = Exact<{
  input: AuthRequestPasswordResetInput;
}>;

export type RequestPasswordResetFromForgotPasswordMutation = {
  __typename?: "Mutation";
  requestPasswordReset: {
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
  resetPassword: boolean;
};

export type SendVerificationEmailFromVerifyEmailMutationVariables = Exact<{
  input: AuthSendVerificationEmailInput;
}>;

export type SendVerificationEmailFromVerifyEmailMutation = {
  __typename?: "Mutation";
  sendVerificationEmail: boolean;
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
    workspaceId: string;
    id: string;
    email: string;
    roles: Array<WorkspaceRole>;
    status: WorkspaceInvitationStatus;
    expiresAt: any;
    workspace: { __typename?: "Workspace"; id: string; name: string };
  } | null;
};

export type AcceptWorkspaceInvitationFromInviteRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type AcceptWorkspaceInvitationFromInviteRouteMutation = {
  __typename?: "Mutation";
  acceptWorkspaceInvitation: {
    __typename?: "AcceptWorkspaceInvitationPayload";
    id: string;
    memberId: string;
    workspaceId: string;
  };
};

export type AddWorkspaceServiceAccountFromWorkspaceMembersRouteMutationVariables =
  Exact<{
    input: AddWorkspaceMemberInput;
  }>;

export type AddWorkspaceServiceAccountFromWorkspaceMembersRouteMutation = {
  __typename?: "Mutation";
  addWorkspaceMember: { __typename?: "AddWorkspaceMemberPayload"; id: string };
};

export type RevokeUserApiKeyFromApiKeysRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type RevokeUserApiKeyFromApiKeysRouteMutation = {
  __typename?: "Mutation";
  revokeUserApiKey: {
    __typename?: "UserApiKey";
    id: string;
    revokedAt?: any | null;
  };
};

export type RevokeWorkspaceApiKeyMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type RevokeWorkspaceApiKeyMutation = {
  __typename?: "Mutation";
  revokeWorkspaceApiKey: {
    __typename?: "WorkspaceApiKey";
    id: string;
    revokedAt?: any | null;
  };
};

export type UpdateUserApiKeyFromUserApiKeysRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateUserApiKeyInput;
}>;

export type UpdateUserApiKeyFromUserApiKeysRouteMutation = {
  __typename?: "Mutation";
  updateUserApiKey: {
    __typename?: "UserApiKey";
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    revokedAt?: any | null;
    permissions: Array<UserApiKeyPermission>;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
  };
};

export type UpdateWorkspaceApiKeyMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateWorkspaceApiKeyInput;
}>;

export type UpdateWorkspaceApiKeyMutation = {
  __typename?: "Mutation";
  updateWorkspaceApiKey: {
    __typename?: "WorkspaceApiKey";
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    revokedAt?: any | null;
    permissions: Array<WorkspaceApiKeyPermission>;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
  };
};

export type SystemAccountPermissionChoicesQueryVariables = Exact<{
  [key: string]: never;
}>;

export type SystemAccountPermissionChoicesQuery = {
  __typename?: "Query";
  systemAccountPermissions: Array<{
    __typename?: "SystemAccountPermissionOption";
    permission: SystemAccountPermission;
    grantable: boolean;
    default: boolean;
  }>;
};

export type ManagedSystemAccountQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type ManagedSystemAccountQuery = {
  __typename?: "Query";
  systemAccount?: {
    __typename?: "SystemAccount";
    id: string;
    name: string;
    enabled: boolean;
    permissions: Array<SystemAccountPermission>;
    createdById?: string | null;
    createdAt: any;
  } | null;
};

export type CreateManagedSystemAccountMutationVariables = Exact<{
  input: CreateSystemAccountInput;
}>;

export type CreateManagedSystemAccountMutation = {
  __typename?: "Mutation";
  createSystemAccount: { __typename?: "SystemAccount"; id: string };
};

export type UpdateManagedSystemAccountMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateSystemAccountInput;
}>;

export type UpdateManagedSystemAccountMutation = {
  __typename?: "Mutation";
  updateSystemAccount: { __typename?: "SystemAccount"; id: string };
};

export type DeleteManagedSystemAccountMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DeleteManagedSystemAccountMutation = {
  __typename?: "Mutation";
  deleteSystemAccount: { __typename?: "SystemAccount"; id: string };
};

export type CreateSystemApiKeyMutationVariables = Exact<{
  input: CreateSystemApiKeyInput;
}>;

export type CreateSystemApiKeyMutation = {
  __typename?: "Mutation";
  createSystemApiKey: {
    __typename?: "CreateSystemApiKeyResult";
    apiKey: string;
    entity: { __typename?: "SystemApiKey"; id: string };
  };
};

export type SystemApiKeyQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type SystemApiKeyQuery = {
  __typename?: "Query";
  systemApiKey?: {
    __typename?: "SystemApiKey";
    id: string;
    name: string;
    revokedAt?: any | null;
    permissions: Array<SystemApiKeyPermission>;
    prefix?: string | null;
    start?: string | null;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
    systemAccount?: {
      __typename: "SystemAccount";
      id: string;
      name: string;
    } | null;
  } | null;
};

export type UpdateSystemApiKeyMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateSystemApiKeyInput;
}>;

export type UpdateSystemApiKeyMutation = {
  __typename?: "Mutation";
  updateSystemApiKey: { __typename?: "SystemApiKey"; id: string };
};

export type DeleteSystemApiKeyMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DeleteSystemApiKeyMutation = {
  __typename?: "Mutation";
  deleteSystemApiKey: { __typename?: "SystemApiKey"; id: string };
};

export type SystemKeyPermissionChoicesQueryVariables = Exact<{
  systemAccountId?: InputMaybe<Scalars["ID"]["input"]>;
  apiKeyId?: InputMaybe<Scalars["ID"]["input"]>;
}>;

export type SystemKeyPermissionChoicesQuery = {
  __typename?: "Query";
  systemApiKeyPermissions: Array<{
    __typename?: "SystemApiKeyPermissionOption";
    permission: SystemApiKeyPermission;
    grantable: boolean;
    default: boolean;
  }>;
};

export type SystemKeyAccountChoicesQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type SystemKeyAccountChoicesQuery = {
  __typename?: "Query";
  systemAccounts: {
    __typename?: "SystemAccountConnection";
    edges: Array<{
      __typename?: "SystemAccountEdge";
      node: {
        __typename?: "SystemAccount";
        id: string;
        name: string;
        apiKeyPermissions: Array<{
          __typename?: "SystemApiKeyPermissionOption";
          permission: SystemApiKeyPermission;
          grantable: boolean;
          default: boolean;
        }>;
      };
    }>;
    pageInfo: {
      __typename?: "PageInfo";
      hasNextPage: boolean;
      endCursor?: string | null;
    };
  };
};

export type RevokeSystemApiKeyMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type RevokeSystemApiKeyMutation = {
  __typename?: "Mutation";
  revokeSystemApiKey: {
    __typename?: "SystemApiKey";
    id: string;
    revokedAt?: any | null;
  };
};

export type GetPasswordPolicyQueryVariables = Exact<{ [key: string]: never }>;

export type GetPasswordPolicyQuery = {
  __typename?: "Query";
  passwordPolicy: {
    __typename?: "PasswordPolicy";
    minLength: number;
    maxLength: number;
  };
};

export const SystemApiKeysDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "systemApiKeys" },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "last" } },
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
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "SystemApiKeyFilter" },
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
            name: { kind: "Name", value: "SystemApiKeyOrder" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "systemApiKeys" },
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
                name: { kind: "Name", value: "last" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "last" },
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
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
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
                              name: { kind: "Name", value: "systemAccount" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "__typename" },
                                  },
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
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "revokedAt" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "permissions" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "prefix" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "start" },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SystemApiKeysQuery, SystemApiKeysQueryVariables>;
export const GetAdminOverviewDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getAdminOverview" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includeUsers" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "Boolean" },
            },
          },
          defaultValue: { kind: "BooleanValue", value: true },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "users" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "1" },
              },
            ],
            directives: [
              {
                kind: "Directive",
                name: { kind: "Name", value: "include" },
                arguments: [
                  {
                    kind: "Argument",
                    name: { kind: "Name", value: "if" },
                    value: {
                      kind: "Variable",
                      name: { kind: "Name", value: "includeUsers" },
                    },
                  },
                ],
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "totalCountRelation" },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetAdminOverviewQuery,
  GetAdminOverviewQueryVariables
>;
export const GetAdminSystemAccountOverviewDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getAdminSystemAccountOverview" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "systemAccounts" },
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
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "totalCountRelation" },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetAdminSystemAccountOverviewQuery,
  GetAdminSystemAccountOverviewQueryVariables
>;
export const GetAdminSystemKeyOverviewDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getAdminSystemKeyOverview" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "systemApiKeys" },
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
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "totalCountRelation" },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetAdminSystemKeyOverviewQuery,
  GetAdminSystemKeyOverviewQueryVariables
>;
export const ManagedSystemAccountsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "managedSystemAccounts" },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "last" } },
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
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "SystemAccountFilter" },
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
            name: { kind: "Name", value: "SystemAccountOrder" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "systemAccounts" },
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
                name: { kind: "Name", value: "last" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "last" },
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
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
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
  ManagedSystemAccountsQuery,
  ManagedSystemAccountsQueryVariables
>;
export const GetAdminUserNeighborsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getAdminUserNeighbors" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "cursor" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
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
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "UserFilter" },
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
            name: { kind: "Name", value: "UserOrder" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            alias: { kind: "Name", value: "previous" },
            name: { kind: "Name", value: "users" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "last" },
                value: { kind: "IntValue", value: "1" },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "before" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "cursor" },
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
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
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
                        name: { kind: "Name", value: "cursor" },
                      },
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
          {
            kind: "Field",
            alias: { kind: "Name", value: "next" },
            name: { kind: "Name", value: "users" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "1" },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "after" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "cursor" },
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
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
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
                        name: { kind: "Name", value: "cursor" },
                      },
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
  GetAdminUserNeighborsQuery,
  GetAdminUserNeighborsQueryVariables
>;
export const GetUserFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getUserFromUserRoute" },
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
            name: { kind: "Name", value: "sessionsAfter" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includeSessions" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "Boolean" },
            },
          },
          defaultValue: { kind: "BooleanValue", value: false },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includeRoles" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "Boolean" },
            },
          },
          defaultValue: { kind: "BooleanValue", value: false },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includePermissions" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "Boolean" },
            },
          },
          defaultValue: { kind: "BooleanValue", value: false },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "user" },
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "emailVerified" },
                },
                { kind: "Field", name: { kind: "Name", value: "image" } },
                { kind: "Field", name: { kind: "Name", value: "roles" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "banned" } },
                { kind: "Field", name: { kind: "Name", value: "banReason" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "banExpiresAt" },
                },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "sessions" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "20" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "sessionsAfter" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "orderBy" },
                      value: {
                        kind: "ObjectValue",
                        fields: [
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "field" },
                            value: { kind: "EnumValue", value: "CREATED_AT" },
                          },
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "direction" },
                            value: { kind: "EnumValue", value: "DESC" },
                          },
                        ],
                      },
                    },
                  ],
                  directives: [
                    {
                      kind: "Directive",
                      name: { kind: "Name", value: "include" },
                      arguments: [
                        {
                          kind: "Argument",
                          name: { kind: "Name", value: "if" },
                          value: {
                            kind: "Variable",
                            name: { kind: "Name", value: "includeSessions" },
                          },
                        },
                      ],
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
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
                              name: { kind: "Name", value: "endCursor" },
                            },
                          ],
                        },
                      },
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
                                    name: { kind: "Name", value: "expiresAt" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "ipAddress" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "userAgent" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "createdAt" },
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
          {
            kind: "Field",
            name: { kind: "Name", value: "userRoles" },
            directives: [
              {
                kind: "Directive",
                name: { kind: "Name", value: "include" },
                arguments: [
                  {
                    kind: "Argument",
                    name: { kind: "Name", value: "if" },
                    value: {
                      kind: "Variable",
                      name: { kind: "Name", value: "includeRoles" },
                    },
                  },
                ],
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "role" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "userPermissions" },
            directives: [
              {
                kind: "Directive",
                name: { kind: "Name", value: "include" },
                arguments: [
                  {
                    kind: "Argument",
                    name: { kind: "Name", value: "if" },
                    value: {
                      kind: "Variable",
                      name: { kind: "Name", value: "includePermissions" },
                    },
                  },
                ],
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "permission" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetUserFromUserRouteQuery,
  GetUserFromUserRouteQueryVariables
>;
export const UpdateManagedUserFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateManagedUserFromUserRoute" },
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
              name: { kind: "Name", value: "UpdateUserInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateUser" },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateManagedUserFromUserRouteMutation,
  UpdateManagedUserFromUserRouteMutationVariables
>;
export const SetUserPermissionsFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "setUserPermissionsFromUserRoute" },
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
              name: { kind: "Name", value: "SetUserPermissionsInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "setUserPermissions" },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SetUserPermissionsFromUserRouteMutation,
  SetUserPermissionsFromUserRouteMutationVariables
>;
export const SetUserRolesFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "setUserRolesFromUserRoute" },
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
              name: { kind: "Name", value: "SetUserRolesInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "setUserRoles" },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SetUserRolesFromUserRouteMutation,
  SetUserRolesFromUserRouteMutationVariables
>;
export const BanUserFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "banUserFromUserRoute" },
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
            kind: "NamedType",
            name: { kind: "Name", value: "BanUserInput" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "banUser" },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  BanUserFromUserRouteMutation,
  BanUserFromUserRouteMutationVariables
>;
export const UnbanUserFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "unbanUserFromUserRoute" },
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
            name: { kind: "Name", value: "unbanUser" },
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
  UnbanUserFromUserRouteMutation,
  UnbanUserFromUserRouteMutationVariables
>;
export const SetUserPasswordFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "setUserPasswordFromUserRoute" },
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
              name: { kind: "Name", value: "SetUserPasswordInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "setUserPassword" },
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
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SetUserPasswordFromUserRouteMutation,
  SetUserPasswordFromUserRouteMutationVariables
>;
export const RevokeUserSessionFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "revokeUserSessionFromUserRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "userId" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
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
            name: { kind: "Name", value: "revokeSession" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "userId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "userId" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RevokeUserSessionFromUserRouteMutation,
  RevokeUserSessionFromUserRouteMutationVariables
>;
export const RevokeUserSessionsFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "revokeUserSessionsFromUserRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "userId" },
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
            name: { kind: "Name", value: "revokeUserSessions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "userId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "userId" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RevokeUserSessionsFromUserRouteMutation,
  RevokeUserSessionsFromUserRouteMutationVariables
>;
export const DeleteUserFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deleteUserFromUserRoute" },
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
            name: { kind: "Name", value: "deleteUser" },
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
  DeleteUserFromUserRouteMutation,
  DeleteUserFromUserRouteMutationVariables
>;
export const ImpersonateUserFromUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "impersonateUserFromUserRoute" },
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
            name: { kind: "Name", value: "impersonateUser" },
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
  ImpersonateUserFromUserRouteMutation,
  ImpersonateUserFromUserRouteMutationVariables
>;
export const CreateUserFromCreateUserRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createUserFromCreateUserRoute" },
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
              name: { kind: "Name", value: "CreateUserInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createUser" },
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
  CreateUserFromCreateUserRouteMutation,
  CreateUserFromCreateUserRouteMutationVariables
>;
export const GetUsersFromUsersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getUsersFromUsersRoute" },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "last" } },
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
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "UserFilter" },
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
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "orderBy" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "UserOrder" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "users" },
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
                name: { kind: "Name", value: "last" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "last" },
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
                              name: { kind: "Name", value: "email" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "emailVerified" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "banned" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "createdAt" },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetUsersFromUsersRouteQuery,
  GetUsersFromUsersRouteQueryVariables
>;
export const SignOutFromSidebarUserDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "signOutFromSidebarUser" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "signOut" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SignOutFromSidebarUserMutation,
  SignOutFromSidebarUserMutationVariables
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
            name: { kind: "Name", value: "currentUser" },
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
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "totalCount" },
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
  GetWorkspacesFromWorkspaceSwitcherQuery,
  GetWorkspacesFromWorkspaceSwitcherQueryVariables
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
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "currentSession" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "impersonatedById" },
                },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "currentAbilityRules" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "actions" } },
                { kind: "Field", name: { kind: "Name", value: "subjects" } },
                { kind: "Field", name: { kind: "Name", value: "fields" } },
                { kind: "Field", name: { kind: "Name", value: "conditions" } },
                { kind: "Field", name: { kind: "Name", value: "inverted" } },
                { kind: "Field", name: { kind: "Name", value: "reason" } },
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
export const StopImpersonatingFromAuthenticatedRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "stopImpersonatingFromAuthenticatedRoute" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "stopImpersonating" },
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
  StopImpersonatingFromAuthenticatedRouteMutation,
  StopImpersonatingFromAuthenticatedRouteMutationVariables
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
                { kind: "Field", name: { kind: "Name", value: "revokedAt" } },
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
export const GetUserApiKeyDetailsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getUserApiKeyDetails" },
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
            name: { kind: "Name", value: "userApiKeyPermissions" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "permission" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
                { kind: "Field", name: { kind: "Name", value: "default" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "currentUser" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "apiKey" },
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
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "prefix" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "revokedAt" },
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
  GetUserApiKeyDetailsQuery,
  GetUserApiKeyDetailsQueryVariables
>;
export const GetUserApiKeyNeighborsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getUserApiKeyNeighbors" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "cursor" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "UserApiKeyFilter" },
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
            name: { kind: "Name", value: "UserApiKeyOrder" },
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
            name: { kind: "Name", value: "currentUser" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                {
                  kind: "Field",
                  alias: { kind: "Name", value: "previous" },
                  name: { kind: "Name", value: "apiKeys" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "last" },
                      value: { kind: "IntValue", value: "1" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "before" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "cursor" },
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
                      name: { kind: "Name", value: "orderBy" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "orderBy" },
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
                              name: { kind: "Name", value: "cursor" },
                            },
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
                {
                  kind: "Field",
                  alias: { kind: "Name", value: "next" },
                  name: { kind: "Name", value: "apiKeys" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "1" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "cursor" },
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
                      name: { kind: "Name", value: "orderBy" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "orderBy" },
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
                              name: { kind: "Name", value: "cursor" },
                            },
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
      },
    },
  ],
} as unknown as DocumentNode<
  GetUserApiKeyNeighborsQuery,
  GetUserApiKeyNeighborsQueryVariables
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
              name: { kind: "Name", value: "CreateUserApiKeyInput" },
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
                        name: { kind: "Name", value: "revokedAt" },
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
export const GetUserApiKeyOptionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getUserApiKeyOptions" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "userApiKeyPermissions" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "permission" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
                { kind: "Field", name: { kind: "Name", value: "default" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetUserApiKeyOptionsQuery,
  GetUserApiKeyOptionsQueryVariables
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
            name: { kind: "Name", value: "UserApiKeyFilter" },
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
            name: { kind: "Name", value: "UserApiKeyOrder" },
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
            name: { kind: "Name", value: "currentUser" },
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
                                    name: { kind: "Name", value: "revokedAt" },
                                  },
                                  {
                                    kind: "Field",
                                    name: {
                                      kind: "Name",
                                      value: "permissions",
                                    },
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
      },
    },
  ],
} as unknown as DocumentNode<
  GetUserApiKeysFromUserApiKeysRouteQuery,
  GetUserApiKeysFromUserApiKeysRouteQueryVariables
>;
export const GetUserOverviewDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getUserOverview" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includeApiKeys" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "Boolean" },
            },
          },
        },
      ],
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
                        name: { kind: "Name", value: "totalCount" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "totalCountRelation" },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "sessions" },
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
                        name: { kind: "Name", value: "totalCount" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "totalCountRelation" },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "apiKeys" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "1" },
                    },
                  ],
                  directives: [
                    {
                      kind: "Directive",
                      name: { kind: "Name", value: "include" },
                      arguments: [
                        {
                          kind: "Argument",
                          name: { kind: "Name", value: "if" },
                          value: {
                            kind: "Variable",
                            name: { kind: "Name", value: "includeApiKeys" },
                          },
                        },
                      ],
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "totalCount" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "totalCountRelation" },
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
  GetUserOverviewQuery,
  GetUserOverviewQueryVariables
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
            name: { kind: "Name", value: "updateCurrentUser" },
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
            name: { kind: "Name", value: "changeCurrentUserEmail" },
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
            name: { kind: "Name", value: "changeCurrentUserPassword" },
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
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "after" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "sessions" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "20" },
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
                      name: { kind: "Name", value: "orderBy" },
                      value: {
                        kind: "ObjectValue",
                        fields: [
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "field" },
                            value: { kind: "EnumValue", value: "CREATED_AT" },
                          },
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "direction" },
                            value: { kind: "EnumValue", value: "DESC" },
                          },
                        ],
                      },
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
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
                              name: { kind: "Name", value: "endCursor" },
                            },
                          ],
                        },
                      },
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
                                    name: { kind: "Name", value: "current" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "expiresAt" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "ipAddress" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "userAgent" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "createdAt" },
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
            name: { kind: "Name", value: "revokeCurrentUserSession" },
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
            name: { kind: "Name", value: "revokeCurrentUserOtherSessions" },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RevokeOtherSessionsFromUserSecurityMutation,
  RevokeOtherSessionsFromUserSecurityMutationVariables
>;
export const GetAccountsFromUserSecurityDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getAccountsFromUserSecurity" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "after" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "accounts" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "20" },
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
                      name: { kind: "Name", value: "orderBy" },
                      value: {
                        kind: "ObjectValue",
                        fields: [
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "field" },
                            value: { kind: "EnumValue", value: "CREATED_AT" },
                          },
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "direction" },
                            value: { kind: "EnumValue", value: "DESC" },
                          },
                        ],
                      },
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "totalCount" },
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
                              name: { kind: "Name", value: "endCursor" },
                            },
                          ],
                        },
                      },
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
                                    name: { kind: "Name", value: "accountId" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "issuer" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "providerId" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "scopes" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "createdAt" },
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
      },
    },
  ],
} as unknown as DocumentNode<
  GetAccountsFromUserSecurityQuery,
  GetAccountsFromUserSecurityQueryVariables
>;
export const GetSocialProvidersFromUserSecurityDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getSocialProvidersFromUserSecurity" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "socialProviders" },
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
  GetSocialProvidersFromUserSecurityQuery,
  GetSocialProvidersFromUserSecurityQueryVariables
>;
export const UnlinkAccountFromUserSecurityDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "unlinkAccountFromUserSecurity" },
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
            name: { kind: "Name", value: "unlinkCurrentUserAccount" },
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
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UnlinkAccountFromUserSecurityMutation,
  UnlinkAccountFromUserSecurityMutationVariables
>;
export const LinkAccountFromUserSecurityDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "linkAccountFromUserSecurity" },
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
              name: { kind: "Name", value: "AuthLinkSocialAccountInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "linkCurrentUserAccount" },
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
                { kind: "Field", name: { kind: "Name", value: "url" } },
                { kind: "Field", name: { kind: "Name", value: "redirect" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  LinkAccountFromUserSecurityMutation,
  LinkAccountFromUserSecurityMutationVariables
>;
export const DeleteUserFromUserSecurityDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deleteUserFromUserSecurity" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "AuthDeleteUserInput" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "deleteCurrentUser" },
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
                { kind: "Field", name: { kind: "Name", value: "success" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DeleteUserFromUserSecurityMutation,
  DeleteUserFromUserSecurityMutationVariables
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
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "WorkspaceFilter" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationFirst" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationLast" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationAfter" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationBefore" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentUser" },
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
                      name: { kind: "Name", value: "filter" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "filter" },
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
          {
            kind: "Field",
            name: { kind: "Name", value: "currentUser" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "invitations" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "invitationFirst" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "last" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "invitationLast" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "invitationAfter" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "before" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "invitationBefore" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "orderBy" },
                      value: {
                        kind: "ObjectValue",
                        fields: [
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "field" },
                            value: { kind: "EnumValue", value: "CREATED_AT" },
                          },
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "direction" },
                            value: { kind: "EnumValue", value: "DESC" },
                          },
                        ],
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
                                    name: {
                                      kind: "Name",
                                      value: "workspaceId",
                                    },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "id" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "roles" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "expiresAt" },
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
                              name: { kind: "Name", value: "startCursor" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "hasNextPage" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "hasPreviousPage" },
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
  GetWorkspacesFromUserWorkspacesRouteQuery,
  GetWorkspacesFromUserWorkspacesRouteQueryVariables
>;
export const AcceptWorkspaceInvitationFromUserWorkspacesRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "acceptWorkspaceInvitationFromUserWorkspacesRoute",
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
  AcceptWorkspaceInvitationFromUserWorkspacesRouteMutation,
  AcceptWorkspaceInvitationFromUserWorkspacesRouteMutationVariables
>;
export const RejectWorkspaceInvitationFromUserWorkspacesRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "rejectWorkspaceInvitationFromUserWorkspacesRoute",
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
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "rejectWorkspaceInvitation" },
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
  RejectWorkspaceInvitationFromUserWorkspacesRouteMutation,
  RejectWorkspaceInvitationFromUserWorkspacesRouteMutationVariables
>;
export const DeleteWorkspaceApiKeyDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deleteWorkspaceApiKey" },
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
            name: { kind: "Name", value: "deleteWorkspaceApiKey" },
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
                { kind: "Field", name: { kind: "Name", value: "revokedAt" } },
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
  DeleteWorkspaceApiKeyMutation,
  DeleteWorkspaceApiKeyMutationVariables
>;
export const GetWorkspaceApiKeyDetailsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getWorkspaceApiKeyDetails" },
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
            name: { kind: "Name", value: "workspaceApiKeyPermissions" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "permission" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
                { kind: "Field", name: { kind: "Name", value: "default" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "currentWorkspace" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "apiKey" },
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
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "member" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "__typename" },
                            },
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
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "start" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "prefix" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "revokedAt" },
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
  GetWorkspaceApiKeyDetailsQuery,
  GetWorkspaceApiKeyDetailsQueryVariables
>;
export const GetWorkspaceApiKeyNeighborsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getWorkspaceApiKeyNeighbors" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "cursor" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "WorkspaceApiKeyFilter" },
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
            name: { kind: "Name", value: "WorkspaceApiKeyOrder" },
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
            name: { kind: "Name", value: "currentWorkspace" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
          {
            kind: "Field",
            alias: { kind: "Name", value: "previous" },
            name: { kind: "Name", value: "workspaceApiKeys" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "last" },
                value: { kind: "IntValue", value: "1" },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "before" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "cursor" },
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
                name: { kind: "Name", value: "orderBy" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "orderBy" },
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
                        name: { kind: "Name", value: "cursor" },
                      },
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
          {
            kind: "Field",
            alias: { kind: "Name", value: "next" },
            name: { kind: "Name", value: "workspaceApiKeys" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "1" },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "after" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "cursor" },
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
                name: { kind: "Name", value: "orderBy" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "orderBy" },
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
                        name: { kind: "Name", value: "cursor" },
                      },
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
  GetWorkspaceApiKeyNeighborsQuery,
  GetWorkspaceApiKeyNeighborsQueryVariables
>;
export const CreateWorkspaceApiKeyDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createWorkspaceApiKey" },
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
              name: { kind: "Name", value: "CreateWorkspaceApiKeyInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createWorkspaceApiKey" },
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
                        name: { kind: "Name", value: "revokedAt" },
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
  CreateWorkspaceApiKeyMutation,
  CreateWorkspaceApiKeyMutationVariables
>;
export const GetWorkspaceApiKeyOptionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getWorkspaceApiKeyOptions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includeWorkspaceMembers" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "Boolean" },
            },
          },
          defaultValue: { kind: "BooleanValue", value: false },
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
            name: { kind: "Name", value: "memberFilter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "WorkspaceMemberFilter" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentWorkspace" },
            directives: [
              {
                kind: "Directive",
                name: { kind: "Name", value: "include" },
                arguments: [
                  {
                    kind: "Argument",
                    name: { kind: "Name", value: "if" },
                    value: {
                      kind: "Variable",
                      name: { kind: "Name", value: "includeWorkspaceMembers" },
                    },
                  },
                ],
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "members" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "100" },
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
                      name: { kind: "Name", value: "filter" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "memberFilter" },
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
                              name: { kind: "Name", value: "endCursor" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "hasNextPage" },
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
            name: { kind: "Name", value: "workspaceApiKeyPermissions" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "permission" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
                { kind: "Field", name: { kind: "Name", value: "default" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetWorkspaceApiKeyOptionsQuery,
  GetWorkspaceApiKeyOptionsQueryVariables
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
            name: { kind: "Name", value: "WorkspaceApiKeyFilter" },
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
            name: { kind: "Name", value: "WorkspaceApiKeyOrder" },
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
            name: { kind: "Name", value: "workspaceApiKeys" },
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
                              name: { kind: "Name", value: "member" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "__typename" },
                                  },
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
                                    name: { kind: "Name", value: "type" },
                                  },
                                  {
                                    kind: "Field",
                                    name: {
                                      kind: "Name",
                                      value: "workspaceId",
                                    },
                                  },
                                ],
                              },
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
                              name: { kind: "Name", value: "revokedAt" },
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
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "currentWorkspaceMember" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "workspaceId" } },
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "roles" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "type" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "currentAbilityRules" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "actions" } },
                { kind: "Field", name: { kind: "Name", value: "subjects" } },
                { kind: "Field", name: { kind: "Name", value: "fields" } },
                { kind: "Field", name: { kind: "Name", value: "conditions" } },
                { kind: "Field", name: { kind: "Name", value: "inverted" } },
                { kind: "Field", name: { kind: "Name", value: "reason" } },
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
export const SetWorkspaceMemberPermissionsFromWorkspaceMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "setWorkspaceMemberPermissionsFromWorkspaceMemberRoute",
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
              name: {
                kind: "Name",
                value: "SetWorkspaceMemberPermissionsInput",
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "setWorkspaceMemberPermissions" },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SetWorkspaceMemberPermissionsFromWorkspaceMemberRouteMutation,
  SetWorkspaceMemberPermissionsFromWorkspaceMemberRouteMutationVariables
>;
export const UpdateWorkspaceMemberFromWorkspaceMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "updateWorkspaceMemberFromWorkspaceMemberRoute",
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateWorkspaceMemberFromWorkspaceMemberRouteMutation,
  UpdateWorkspaceMemberFromWorkspaceMemberRouteMutationVariables
>;
export const SetWorkspaceMemberRolesFromWorkspaceMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "setWorkspaceMemberRolesFromWorkspaceMemberRoute",
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
              name: { kind: "Name", value: "SetWorkspaceMemberRolesInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "setWorkspaceMemberRoles" },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SetWorkspaceMemberRolesFromWorkspaceMemberRouteMutation,
  SetWorkspaceMemberRolesFromWorkspaceMemberRouteMutationVariables
>;
export const GetWorkspaceMemberNeighborsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getWorkspaceMemberNeighbors" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "cursor" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
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
      ],
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
                {
                  kind: "Field",
                  alias: { kind: "Name", value: "previous" },
                  name: { kind: "Name", value: "members" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "last" },
                      value: { kind: "IntValue", value: "1" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "before" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "cursor" },
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
                      name: { kind: "Name", value: "filter" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "filter" },
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
                              name: { kind: "Name", value: "cursor" },
                            },
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
                {
                  kind: "Field",
                  alias: { kind: "Name", value: "next" },
                  name: { kind: "Name", value: "members" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "1" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "cursor" },
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
                      name: { kind: "Name", value: "filter" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "filter" },
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
                              name: { kind: "Name", value: "cursor" },
                            },
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
      },
    },
  ],
} as unknown as DocumentNode<
  GetWorkspaceMemberNeighborsQuery,
  GetWorkspaceMemberNeighborsQueryVariables
>;
export const GetWorkspaceMemberFromWorkspaceMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: {
        kind: "Name",
        value: "getWorkspaceMemberFromWorkspaceMemberRoute",
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
                { kind: "Field", name: { kind: "Name", value: "workspaceId" } },
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "roles" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "type" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "workspaceRoles" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "role" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "workspacePermissions" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "permission" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetWorkspaceMemberFromWorkspaceMemberRouteQuery,
  GetWorkspaceMemberFromWorkspaceMemberRouteQueryVariables
>;
export const RemoveWorkspaceMemberFromWorkspaceMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "removeWorkspaceMemberFromWorkspaceMemberRoute",
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
  RemoveWorkspaceMemberFromWorkspaceMemberRouteMutation,
  RemoveWorkspaceMemberFromWorkspaceMemberRouteMutationVariables
>;
export const UpdateWorkspaceMemberStatusFromWorkspaceMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "updateWorkspaceMemberStatusFromWorkspaceMembersRoute",
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateWorkspaceMemberStatusFromWorkspaceMembersRouteMutation,
  UpdateWorkspaceMemberStatusFromWorkspaceMembersRouteMutationVariables
>;
export const GetWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRouteDocument =
  {
    kind: "Document",
    definitions: [
      {
        kind: "OperationDefinition",
        operation: "query",
        name: {
          kind: "Name",
          value:
            "getWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRoute",
        },
        selectionSet: {
          kind: "SelectionSet",
          selections: [
            {
              kind: "Field",
              name: { kind: "Name", value: "workspaceRoles" },
              selectionSet: {
                kind: "SelectionSet",
                selections: [
                  { kind: "Field", name: { kind: "Name", value: "role" } },
                  { kind: "Field", name: { kind: "Name", value: "grantable" } },
                ],
              },
            },
            {
              kind: "Field",
              name: { kind: "Name", value: "workspacePermissions" },
              selectionSet: {
                kind: "SelectionSet",
                selections: [
                  {
                    kind: "Field",
                    name: { kind: "Name", value: "permission" },
                  },
                  { kind: "Field", name: { kind: "Name", value: "grantable" } },
                ],
              },
            },
          ],
        },
      },
    ],
  } as unknown as DocumentNode<
    GetWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRouteQuery,
    GetWorkspaceServiceAccountGrantsFromCreateWorkspaceMemberRouteQueryVariables
  >;
export const GetRolesFromInviteWorkspaceMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getRolesFromInviteWorkspaceMemberRoute" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "workspaceRoles" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "role" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetRolesFromInviteWorkspaceMemberRouteQuery,
  GetRolesFromInviteWorkspaceMemberRouteQueryVariables
>;
export const CreateWorkspaceInvitationFromInviteWorkspaceMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "createWorkspaceInvitationFromInviteWorkspaceMemberRoute",
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
  CreateWorkspaceInvitationFromInviteWorkspaceMemberRouteMutation,
  CreateWorkspaceInvitationFromInviteWorkspaceMemberRouteMutationVariables
>;
export const GetWorkspaceMembersFromWorkspaceMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: {
        kind: "Name",
        value: "getWorkspaceMembersFromWorkspaceMembersRoute",
      },
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
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationFirst" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationLast" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationAfter" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationBefore" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "invitationFilter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "WorkspaceInvitationFilter" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includeWorkspaceInvitations" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "Boolean" },
            },
          },
          defaultValue: { kind: "BooleanValue", value: false },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "currentWorkspace" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "members" },
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
                                    name: {
                                      kind: "Name",
                                      value: "workspaceId",
                                    },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "id" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "roles" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "status" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "type" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "createdAt" },
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
          {
            kind: "Field",
            name: { kind: "Name", value: "currentWorkspace" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "invitations" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "invitationFirst" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "last" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "invitationLast" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "invitationAfter" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "before" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "invitationBefore" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "filter" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "invitationFilter" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "orderBy" },
                      value: {
                        kind: "ObjectValue",
                        fields: [
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "field" },
                            value: { kind: "EnumValue", value: "CREATED_AT" },
                          },
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "direction" },
                            value: { kind: "EnumValue", value: "DESC" },
                          },
                        ],
                      },
                    },
                  ],
                  directives: [
                    {
                      kind: "Directive",
                      name: { kind: "Name", value: "include" },
                      arguments: [
                        {
                          kind: "Argument",
                          name: { kind: "Name", value: "if" },
                          value: {
                            kind: "Variable",
                            name: {
                              kind: "Name",
                              value: "includeWorkspaceInvitations",
                            },
                          },
                        },
                      ],
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
                                    name: {
                                      kind: "Name",
                                      value: "workspaceId",
                                    },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "id" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "email" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "roles" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "status" },
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
                              name: { kind: "Name", value: "startCursor" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "hasNextPage" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "hasPreviousPage" },
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
  GetWorkspaceMembersFromWorkspaceMembersRouteQuery,
  GetWorkspaceMembersFromWorkspaceMembersRouteQueryVariables
>;
export const CancelWorkspaceInvitationFromWorkspaceMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "cancelWorkspaceInvitationFromWorkspaceMembersRoute",
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
  CancelWorkspaceInvitationFromWorkspaceMembersRouteMutation,
  CancelWorkspaceInvitationFromWorkspaceMembersRouteMutationVariables
>;
export const GetWorkspaceOverviewDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getWorkspaceOverview" },
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
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includeWorkspaceMembers" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "Boolean" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includeApiKeys" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "Boolean" },
            },
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "members" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "1" },
                    },
                  ],
                  directives: [
                    {
                      kind: "Directive",
                      name: { kind: "Name", value: "include" },
                      arguments: [
                        {
                          kind: "Argument",
                          name: { kind: "Name", value: "if" },
                          value: {
                            kind: "Variable",
                            name: {
                              kind: "Name",
                              value: "includeWorkspaceMembers",
                            },
                          },
                        },
                      ],
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "totalCount" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "totalCountRelation" },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "workspaceApiKeys" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "1" },
              },
            ],
            directives: [
              {
                kind: "Directive",
                name: { kind: "Name", value: "include" },
                arguments: [
                  {
                    kind: "Argument",
                    name: { kind: "Name", value: "if" },
                    value: {
                      kind: "Variable",
                      name: { kind: "Name", value: "includeApiKeys" },
                    },
                  },
                ],
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "totalCountRelation" },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetWorkspaceOverviewQuery,
  GetWorkspaceOverviewQueryVariables
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
            name: { kind: "Name", value: "deleteWorkspace" },
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
  DeleteWorkspaceFromSettingsRouteMutation,
  DeleteWorkspaceFromSettingsRouteMutationVariables
>;
export const LeaveWorkspaceFromSettingsRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "leaveWorkspaceFromSettingsRoute" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "leaveWorkspace" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "memberId" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  LeaveWorkspaceFromSettingsRouteMutation,
  LeaveWorkspaceFromSettingsRouteMutationVariables
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
            name: { kind: "Name", value: "currentUser" },
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
      },
    },
  ],
} as unknown as DocumentNode<
  GetFirstWorkspaceFromWorkspacesRouteQuery,
  GetFirstWorkspaceFromWorkspacesRouteQueryVariables
>;
export const SignInFromLoginFormDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "signInFromLoginForm" },
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
            name: { kind: "Name", value: "signIn" },
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
  SignInFromLoginFormMutation,
  SignInFromLoginFormMutationVariables
>;
export const SignUpFromLoginFormDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "signUpFromLoginForm" },
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
            name: { kind: "Name", value: "signUp" },
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
  SignUpFromLoginFormMutation,
  SignUpFromLoginFormMutationVariables
>;
export const GetSocialProvidersFromLoginFormDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getSocialProvidersFromLoginForm" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "socialProviders" },
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
  GetSocialProvidersFromLoginFormQuery,
  GetSocialProvidersFromLoginFormQueryVariables
>;
export const SignInSocialFromLoginFormDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "signInSocialFromLoginForm" },
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
              name: { kind: "Name", value: "AuthSignInSocialInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "signInSocial" },
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
                { kind: "Field", name: { kind: "Name", value: "redirect" } },
                { kind: "Field", name: { kind: "Name", value: "url" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SignInSocialFromLoginFormMutation,
  SignInSocialFromLoginFormMutationVariables
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
            name: { kind: "Name", value: "requestPasswordReset" },
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
            name: { kind: "Name", value: "resetPassword" },
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
            name: { kind: "Name", value: "sendVerificationEmail" },
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
                { kind: "Field", name: { kind: "Name", value: "workspaceId" } },
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "roles" } },
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
            name: { kind: "Name", value: "acceptWorkspaceInvitation" },
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
                { kind: "Field", name: { kind: "Name", value: "memberId" } },
                { kind: "Field", name: { kind: "Name", value: "workspaceId" } },
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
export const AddWorkspaceServiceAccountFromWorkspaceMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "addWorkspaceServiceAccountFromWorkspaceMembersRoute",
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
              name: { kind: "Name", value: "AddWorkspaceMemberInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "addWorkspaceMember" },
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
  AddWorkspaceServiceAccountFromWorkspaceMembersRouteMutation,
  AddWorkspaceServiceAccountFromWorkspaceMembersRouteMutationVariables
>;
export const RevokeUserApiKeyFromApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "revokeUserApiKeyFromApiKeysRoute" },
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
            name: { kind: "Name", value: "revokeUserApiKey" },
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
                { kind: "Field", name: { kind: "Name", value: "revokedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RevokeUserApiKeyFromApiKeysRouteMutation,
  RevokeUserApiKeyFromApiKeysRouteMutationVariables
>;
export const RevokeWorkspaceApiKeyDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "revokeWorkspaceApiKey" },
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
            name: { kind: "Name", value: "revokeWorkspaceApiKey" },
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
                { kind: "Field", name: { kind: "Name", value: "revokedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RevokeWorkspaceApiKeyMutation,
  RevokeWorkspaceApiKeyMutationVariables
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
              name: { kind: "Name", value: "UpdateUserApiKeyInput" },
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
                { kind: "Field", name: { kind: "Name", value: "revokedAt" } },
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
export const UpdateWorkspaceApiKeyDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateWorkspaceApiKey" },
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
              name: { kind: "Name", value: "UpdateWorkspaceApiKeyInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateWorkspaceApiKey" },
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
                { kind: "Field", name: { kind: "Name", value: "revokedAt" } },
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
  UpdateWorkspaceApiKeyMutation,
  UpdateWorkspaceApiKeyMutationVariables
>;
export const SystemAccountPermissionChoicesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "systemAccountPermissionChoices" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "systemAccountPermissions" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "permission" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
                { kind: "Field", name: { kind: "Name", value: "default" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SystemAccountPermissionChoicesQuery,
  SystemAccountPermissionChoicesQueryVariables
>;
export const ManagedSystemAccountDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "managedSystemAccount" },
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
            name: { kind: "Name", value: "systemAccount" },
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
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "createdById" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ManagedSystemAccountQuery,
  ManagedSystemAccountQueryVariables
>;
export const CreateManagedSystemAccountDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createManagedSystemAccount" },
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
              name: { kind: "Name", value: "CreateSystemAccountInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createSystemAccount" },
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
  CreateManagedSystemAccountMutation,
  CreateManagedSystemAccountMutationVariables
>;
export const UpdateManagedSystemAccountDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateManagedSystemAccount" },
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
              name: { kind: "Name", value: "UpdateSystemAccountInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateSystemAccount" },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateManagedSystemAccountMutation,
  UpdateManagedSystemAccountMutationVariables
>;
export const DeleteManagedSystemAccountDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deleteManagedSystemAccount" },
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
            name: { kind: "Name", value: "deleteSystemAccount" },
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
  DeleteManagedSystemAccountMutation,
  DeleteManagedSystemAccountMutationVariables
>;
export const CreateSystemApiKeyDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createSystemApiKey" },
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
              name: { kind: "Name", value: "CreateSystemApiKeyInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createSystemApiKey" },
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
  CreateSystemApiKeyMutation,
  CreateSystemApiKeyMutationVariables
>;
export const SystemApiKeyDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "systemApiKey" },
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
            name: { kind: "Name", value: "systemApiKey" },
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "systemAccount" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "__typename" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "revokedAt" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
                { kind: "Field", name: { kind: "Name", value: "prefix" } },
                { kind: "Field", name: { kind: "Name", value: "start" } },
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
} as unknown as DocumentNode<SystemApiKeyQuery, SystemApiKeyQueryVariables>;
export const UpdateSystemApiKeyDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateSystemApiKey" },
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
              name: { kind: "Name", value: "UpdateSystemApiKeyInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateSystemApiKey" },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateSystemApiKeyMutation,
  UpdateSystemApiKeyMutationVariables
>;
export const DeleteSystemApiKeyDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deleteSystemApiKey" },
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
            name: { kind: "Name", value: "deleteSystemApiKey" },
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
  DeleteSystemApiKeyMutation,
  DeleteSystemApiKeyMutationVariables
>;
export const SystemKeyPermissionChoicesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "systemKeyPermissionChoices" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "systemAccountId" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "apiKeyId" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "systemApiKeyPermissions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "systemAccountId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "systemAccountId" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "apiKeyId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "apiKeyId" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "permission" } },
                { kind: "Field", name: { kind: "Name", value: "grantable" } },
                { kind: "Field", name: { kind: "Name", value: "default" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SystemKeyPermissionChoicesQuery,
  SystemKeyPermissionChoicesQueryVariables
>;
export const SystemKeyAccountChoicesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "systemKeyAccountChoices" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "after" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "systemAccounts" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "100" },
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
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "enabled" },
                      value: { kind: "BooleanValue", value: true },
                    },
                  ],
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
                              name: {
                                kind: "Name",
                                value: "apiKeyPermissions",
                              },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "permission" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "grantable" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "default" },
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
                        name: { kind: "Name", value: "hasNextPage" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "endCursor" },
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
  SystemKeyAccountChoicesQuery,
  SystemKeyAccountChoicesQueryVariables
>;
export const RevokeSystemApiKeyDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "revokeSystemApiKey" },
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
            name: { kind: "Name", value: "revokeSystemApiKey" },
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
                { kind: "Field", name: { kind: "Name", value: "revokedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RevokeSystemApiKeyMutation,
  RevokeSystemApiKeyMutationVariables
>;
export const GetPasswordPolicyDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getPasswordPolicy" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "passwordPolicy" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "minLength" } },
                { kind: "Field", name: { kind: "Name", value: "maxLength" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetPasswordPolicyQuery,
  GetPasswordPolicyQueryVariables
>;
