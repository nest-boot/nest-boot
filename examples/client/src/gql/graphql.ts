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
  /**
   * A filter for Invitation that accepts MongoDB query syntax.
   * Supported fields: email, status, created_at
   */
  InvitationFilter: { input: any; output: any };
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  };
  /**
   * A filter for Member that accepts MongoDB query syntax.
   * Supported fields: name, email, status, created_at
   */
  MemberFilter: { input: any; output: any };
  /**
   * A filter for Session that accepts MongoDB query syntax.
   * Supported fields: created_at
   */
  SessionFilter: { input: any; output: any };
  /**
   * A filter for UserApiKey that accepts MongoDB query syntax.
   * Supported fields: name, prefix, enabled, last_used_at, created_at
   */
  UserApiKeyFilter: { input: any; output: any };
  /**
   * A filter for User that accepts MongoDB query syntax.
   * Supported fields: name, email, created_at
   */
  UserFilter: { input: any; output: any };
  /**
   * A filter for WorkspaceApiKey that accepts MongoDB query syntax.
   * Supported fields: name, prefix, enabled, last_used_at, created_at
   */
  WorkspaceApiKeyFilter: { input: any; output: any };
  /**
   * A filter for Workspace that accepts MongoDB query syntax.
   * Supported fields: name, created_at
   */
  WorkspaceFilter: { input: any; output: any };
};

export type AcceptInvitationPayload = {
  __typename?: "AcceptInvitationPayload";
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
export type AddMemberInput = {
  email: Scalars["String"]["input"];
};

export type AddMemberPayload = {
  __typename?: "AddMemberPayload";
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

export type CancelInvitationPayload = {
  __typename?: "CancelInvitationPayload";
  id: Scalars["ID"]["output"];
};

export type CreateInvitationInput = {
  email: Scalars["String"]["input"];
  expiresIn?: InputMaybe<Scalars["Int"]["input"]>;
  roles: Array<WorkspaceRole>;
};

export type CreateInvitationPayload = {
  __typename?: "CreateInvitationPayload";
  id: Scalars["ID"]["output"];
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

export type Invitation = {
  __typename?: "Invitation";
  createdAt: Scalars["DateTime"]["output"];
  email: Scalars["String"]["output"];
  expiresAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  inviter: User;
  roles: Array<WorkspaceRole>;
  status: InvitationStatus;
  workspace: Workspace;
  workspaceId: Scalars["ID"]["output"];
};

export type InvitationConnection = {
  __typename?: "InvitationConnection";
  /** A list of edges. */
  edges: Array<InvitationEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

/** An auto-generated type which holds one Invitation and a cursor during pagination. */
export type InvitationEdge = {
  __typename?: "InvitationEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of InvitationEdge. */
  node: Invitation;
};

/** Ordering options for invitation connections */
export type InvitationOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order invitations by. */
  field: InvitationOrderField;
};

/** Properties by which invitation connections can be ordered. */
export const InvitationOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
} as const;

export type InvitationOrderField =
  (typeof InvitationOrderField)[keyof typeof InvitationOrderField];
export const InvitationStatus = {
  ACCEPTED: "ACCEPTED",
  CANCELED: "CANCELED",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
} as const;

export type InvitationStatus =
  (typeof InvitationStatus)[keyof typeof InvitationStatus];
export type LeaveWorkspacePayload = {
  __typename?: "LeaveWorkspacePayload";
  memberId: Scalars["ID"]["output"];
};

export type Member = {
  __typename?: "Member";
  createdAt: Scalars["DateTime"]["output"];
  email?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  permissions: Array<WorkspacePermission>;
  roles: Array<WorkspaceRole>;
  status: MemberStatus;
  updatedAt: Scalars["DateTime"]["output"];
  user?: Maybe<User>;
  workspaceId: Scalars["ID"]["output"];
};

export type MemberConnection = {
  __typename?: "MemberConnection";
  /** A list of edges. */
  edges: Array<MemberEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies up to 10,000 items in the connection. Use totalCountRelation to determine whether the value is exact. */
  totalCount: Scalars["Int"]["output"];
  /** Indicates whether totalCount is exact or a lower bound. */
  totalCountRelation: TotalCountRelation;
};

/** An auto-generated type which holds one Member and a cursor during pagination. */
export type MemberEdge = {
  __typename?: "MemberEdge";
  /** A cursor for use in pagination. */
  cursor: Scalars["String"]["output"];
  /** The item at the end of MemberEdge. */
  node: Member;
};

/** Ordering options for member connections */
export type MemberOrder = {
  /** The ordering direction. */
  direction: OrderDirection;
  /** The field to order members by. */
  field: MemberOrderField;
};

/** Properties by which member connections can be ordered. */
export const MemberOrderField = {
  CREATED_AT: "CREATED_AT",
  ID: "ID",
} as const;

export type MemberOrderField =
  (typeof MemberOrderField)[keyof typeof MemberOrderField];
export const MemberStatus = {
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
} as const;

export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];
export type Mutation = {
  __typename?: "Mutation";
  acceptInvitation: AcceptInvitationPayload;
  addMember: AddMemberPayload;
  banUser: BanUserPayload;
  cancelInvitation: CancelInvitationPayload;
  changeCurrentUserEmail: Scalars["Boolean"]["output"];
  changeCurrentUserPassword: AuthChangePasswordResultType;
  createInvitation: CreateInvitationPayload;
  createUser: CreateUserPayload;
  createUserApiKey: CreateUserApiKeyResult;
  createWorkspace: CreateWorkspacePayload;
  createWorkspaceApiKey: CreateWorkspaceApiKeyResult;
  deleteCurrentUser: AuthDeleteUserResultType;
  deleteUser: DeleteUserPayload;
  deleteUserApiKey: UserApiKey;
  deleteWorkspace: DeleteWorkspacePayload;
  deleteWorkspaceApiKey: WorkspaceApiKey;
  impersonateUser: User;
  leaveWorkspace: LeaveWorkspacePayload;
  linkCurrentUserAccount: AuthLinkSocialAccountResultType;
  rejectInvitation: RejectInvitationPayload;
  removeMember: RemoveMemberPayload;
  requestPasswordReset: AuthRequestPasswordResetResultType;
  resetPassword: Scalars["Boolean"]["output"];
  revokeCurrentUserOtherSessions: Scalars["Boolean"]["output"];
  revokeCurrentUserSession: Scalars["Boolean"]["output"];
  revokeCurrentUserSessions: Scalars["Boolean"]["output"];
  revokeSession: Scalars["Boolean"]["output"];
  revokeUserSessions: Scalars["Boolean"]["output"];
  sendVerificationEmail: Scalars["Boolean"]["output"];
  setCurrentUserPassword: Scalars["Boolean"]["output"];
  setMemberPermissions: SetMemberPermissionsPayload;
  setMemberRoles: SetMemberRolesPayload;
  setUserPassword: Scalars["Boolean"]["output"];
  setUserPermissions: SetUserPermissionsPayload;
  setUserRoles: SetUserRolesPayload;
  signIn: AuthSignInResultType;
  signInSocial: AuthSignInSocialResultType;
  signOut: Scalars["Boolean"]["output"];
  signUp: SignUpPayload;
  stopImpersonating?: Maybe<User>;
  unbanUser: UnbanUserPayload;
  unlinkCurrentUserAccount: Scalars["Boolean"]["output"];
  updateCurrentUser: Scalars["Boolean"]["output"];
  updateMember?: Maybe<UpdateMemberPayload>;
  updateUser: UpdateUserPayload;
  updateUserApiKey: UserApiKey;
  updateWorkspace: UpdateWorkspacePayload;
  updateWorkspaceApiKey: WorkspaceApiKey;
};

export type MutationAcceptInvitationArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationAddMemberArgs = {
  input: AddMemberInput;
};

export type MutationBanUserArgs = {
  id: Scalars["ID"]["input"];
  input?: InputMaybe<BanUserInput>;
};

export type MutationCancelInvitationArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationChangeCurrentUserEmailArgs = {
  input: AuthChangeEmailInput;
};

export type MutationChangeCurrentUserPasswordArgs = {
  input: AuthChangePasswordInput;
};

export type MutationCreateInvitationArgs = {
  input: CreateInvitationInput;
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

export type MutationDeleteCurrentUserArgs = {
  input?: InputMaybe<AuthDeleteUserInput>;
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

export type MutationRejectInvitationArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationRemoveMemberArgs = {
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

export type MutationRevokeUserSessionsArgs = {
  userId: Scalars["ID"]["input"];
};

export type MutationSendVerificationEmailArgs = {
  input: AuthSendVerificationEmailInput;
};

export type MutationSetCurrentUserPasswordArgs = {
  newPassword: Scalars["String"]["input"];
};

export type MutationSetMemberPermissionsArgs = {
  id: Scalars["ID"]["input"];
  input: SetMemberPermissionsInput;
};

export type MutationSetMemberRolesArgs = {
  id: Scalars["ID"]["input"];
  input: SetMemberRolesInput;
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

export type MutationUpdateMemberArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateMemberInput;
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
  currentMember?: Maybe<Member>;
  currentSession?: Maybe<Session>;
  currentUser: User;
  currentWorkspace?: Maybe<Workspace>;
  invitation?: Maybe<Invitation>;
  member?: Maybe<Member>;
  passwordPolicy: PasswordPolicy;
  socialProviders: Array<AuthSocialProviderType>;
  user?: Maybe<User>;
  userApiKeyPermissions: Array<UserApiKeyPermissionOption>;
  userPermissions: Array<UserPermissionOption>;
  userRoles: Array<UserRoleOption>;
  users: UserConnection;
  workspace?: Maybe<Workspace>;
  workspaceApiKeyPermissions: Array<WorkspaceApiKeyPermissionOption>;
  workspacePermissions: Array<WorkspacePermissionOption>;
  workspaceRoles: Array<WorkspaceRoleOption>;
};

export type QueryInvitationArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryMemberArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryUserArgs = {
  id: Scalars["ID"]["input"];
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

export type RejectInvitationPayload = {
  __typename?: "RejectInvitationPayload";
  id: Scalars["ID"]["output"];
};

export type RemoveMemberPayload = {
  __typename?: "RemoveMemberPayload";
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
export type SetMemberPermissionsInput = {
  permissions: Array<WorkspacePermission>;
};

export type SetMemberPermissionsPayload = {
  __typename?: "SetMemberPermissionsPayload";
  id: Scalars["ID"]["output"];
};

export type SetMemberRolesInput = {
  roles: Array<WorkspaceRole>;
};

export type SetMemberRolesPayload = {
  __typename?: "SetMemberRolesPayload";
  id: Scalars["ID"]["output"];
};

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

export type SignUpPayload = {
  __typename?: "SignUpPayload";
  id: Scalars["ID"]["output"];
  token?: Maybe<Scalars["String"]["output"]>;
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

export type UpdateMemberInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<MemberStatus>;
};

export type UpdateMemberPayload = {
  __typename?: "UpdateMemberPayload";
  id: Scalars["ID"]["output"];
};

export type UpdateUserApiKeyInput = {
  enabled?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  enabled?: InputMaybe<Scalars["Boolean"]["input"]>;
  expiresAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  permissions?: InputMaybe<Array<WorkspaceApiKeyPermission>>;
};

export type UpdateWorkspaceInput = {
  name?: InputMaybe<Scalars["String"]["input"]>;
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
  invitations: InvitationConnection;
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
  filter?: InputMaybe<Scalars["InvitationFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<InvitationOrder>;
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
  enabled: Scalars["Boolean"]["output"];
  expiresAt?: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["ID"]["output"];
  lastUsedAt?: Maybe<Scalars["DateTime"]["output"]>;
  name: Scalars["String"]["output"];
  permissions: Array<UserApiKeyPermission>;
  prefix?: Maybe<Scalars["String"]["output"]>;
  start?: Maybe<Scalars["String"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
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

/** An auto-generated type which holds one UserApiKey and a cursor during pagination. */
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
} as const;

export type UserApiKeyOrderField =
  (typeof UserApiKeyOrderField)[keyof typeof UserApiKeyOrderField];
export const UserApiKeyPermission = {
  MEMBER__INVITE: "MEMBER__INVITE",
  MEMBER__READ: "MEMBER__READ",
  MEMBER__SET_PERMISSIONS: "MEMBER__SET_PERMISSIONS",
  MEMBER__SET_ROLES: "MEMBER__SET_ROLES",
  MEMBER__WRITE: "MEMBER__WRITE",
  SESSION__READ: "SESSION__READ",
  SESSION__REVOKE: "SESSION__REVOKE",
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
  WORKSPACE__CREATE: "WORKSPACE__CREATE",
  WORKSPACE__DELETE: "WORKSPACE__DELETE",
  WORKSPACE__READ: "WORKSPACE__READ",
  WORKSPACE__UPDATE: "WORKSPACE__UPDATE",
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
  apiKeys: WorkspaceApiKeyConnection;
  createdAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  invitations: InvitationConnection;
  members: MemberConnection;
  name: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type WorkspaceApiKeyArgs = {
  id: Scalars["ID"]["input"];
};

export type WorkspaceApiKeysArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["WorkspaceApiKeyFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceApiKeyOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type WorkspaceInvitationsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["InvitationFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<InvitationOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type WorkspaceMembersArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["MemberFilter"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<MemberOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
};

export type WorkspaceApiKey = {
  __typename?: "WorkspaceApiKey";
  createdAt: Scalars["DateTime"]["output"];
  enabled: Scalars["Boolean"]["output"];
  expiresAt?: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["ID"]["output"];
  lastUsedAt?: Maybe<Scalars["DateTime"]["output"]>;
  name: Scalars["String"]["output"];
  permissions: Array<WorkspaceApiKeyPermission>;
  prefix?: Maybe<Scalars["String"]["output"]>;
  start?: Maybe<Scalars["String"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
  workspaceId: Scalars["ID"]["output"];
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

/** An auto-generated type which holds one WorkspaceApiKey and a cursor during pagination. */
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
} as const;

export type WorkspaceApiKeyOrderField =
  (typeof WorkspaceApiKeyOrderField)[keyof typeof WorkspaceApiKeyOrderField];
export const WorkspaceApiKeyPermission = {
  MEMBER__INVITE: "MEMBER__INVITE",
  MEMBER__READ: "MEMBER__READ",
  MEMBER__SET_PERMISSIONS: "MEMBER__SET_PERMISSIONS",
  MEMBER__SET_ROLES: "MEMBER__SET_ROLES",
  MEMBER__WRITE: "MEMBER__WRITE",
  WORKSPACE_API_KEY__READ: "WORKSPACE_API_KEY__READ",
  WORKSPACE_API_KEY__WRITE: "WORKSPACE_API_KEY__WRITE",
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
  MEMBER__INVITE: "MEMBER__INVITE",
  MEMBER__READ: "MEMBER__READ",
  MEMBER__SET_PERMISSIONS: "MEMBER__SET_PERMISSIONS",
  MEMBER__SET_ROLES: "MEMBER__SET_ROLES",
  MEMBER__WRITE: "MEMBER__WRITE",
  WORKSPACE_API_KEY__READ: "WORKSPACE_API_KEY__READ",
  WORKSPACE_API_KEY__WRITE: "WORKSPACE_API_KEY__WRITE",
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

export type SetUserPermissionsFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: SetUserPermissionsInput;
}>;

export type SetUserPermissionsFromUserRouteMutation = {
  __typename?: "Mutation";
  setUserPermissions: { __typename?: "SetUserPermissionsPayload"; id: string };
};

export type UpdateManagedUserFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateUserInput;
}>;

export type UpdateManagedUserFromUserRouteMutation = {
  __typename?: "Mutation";
  updateUser: { __typename?: "UpdateUserPayload"; id: string };
};

export type SetUserRolesFromUserRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: SetUserRolesInput;
}>;

export type SetUserRolesFromUserRouteMutation = {
  __typename?: "Mutation";
  setUserRoles: { __typename?: "SetUserRolesPayload"; id: string };
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

export type GetUsersFromUsersRouteQueryVariables = Exact<{
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  filter?: InputMaybe<Scalars["UserFilter"]["input"]>;
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

export type CreateUserFromUsersRouteMutationVariables = Exact<{
  input: CreateUserInput;
}>;

export type CreateUserFromUsersRouteMutation = {
  __typename?: "Mutation";
  createUser: { __typename?: "CreateUserPayload"; id: string };
};

export type SignOutFromSidebarUserMutationVariables = Exact<{
  [key: string]: never;
}>;

export type SignOutFromSidebarUserMutation = {
  __typename?: "Mutation";
  signOut: boolean;
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
  userApiKeyPermissions: Array<{
    __typename?: "UserApiKeyPermissionOption";
    permission: UserApiKeyPermission;
    grantable: boolean;
    default: boolean;
  }>;
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
          enabled: boolean;
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
      enabled: boolean;
      permissions: Array<UserApiKeyPermission>;
      createdAt: any;
      lastUsedAt?: any | null;
      expiresAt?: any | null;
    };
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
    enabled: boolean;
    permissions: Array<UserApiKeyPermission>;
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
    __typename?: "UserApiKey";
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    enabled: boolean;
    permissions: Array<UserApiKeyPermission>;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
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

export type GetWorkspacesFromUserWorkspacesRouteQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  orderBy?: InputMaybe<WorkspaceOrder>;
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
      __typename?: "InvitationConnection";
      edges: Array<{
        __typename?: "InvitationEdge";
        node: {
          __typename?: "Invitation";
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

export type AcceptInvitationFromUserWorkspacesRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type AcceptInvitationFromUserWorkspacesRouteMutation = {
  __typename?: "Mutation";
  acceptInvitation: { __typename?: "AcceptInvitationPayload"; id: string };
};

export type RejectInvitationFromUserWorkspacesRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type RejectInvitationFromUserWorkspacesRouteMutation = {
  __typename?: "Mutation";
  rejectInvitation: { __typename?: "RejectInvitationPayload"; id: string };
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
  workspaceApiKeyPermissions: Array<{
    __typename?: "WorkspaceApiKeyPermissionOption";
    permission: WorkspaceApiKeyPermission;
    grantable: boolean;
    default: boolean;
  }>;
  currentWorkspace?: {
    __typename?: "Workspace";
    apiKeys: {
      __typename?: "WorkspaceApiKeyConnection";
      edges: Array<{
        __typename?: "WorkspaceApiKeyEdge";
        node: {
          __typename?: "WorkspaceApiKey";
          workspaceId: string;
          id: string;
          name: string;
          start?: string | null;
          prefix?: string | null;
          enabled: boolean;
          permissions: Array<WorkspaceApiKeyPermission>;
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
  } | null;
};

export type CreateWorkspaceApiKeyFromApiKeysRouteMutationVariables = Exact<{
  input: CreateWorkspaceApiKeyInput;
}>;

export type CreateWorkspaceApiKeyFromApiKeysRouteMutation = {
  __typename?: "Mutation";
  createWorkspaceApiKey: {
    __typename?: "CreateWorkspaceApiKeyResult";
    apiKey: string;
    entity: {
      __typename?: "WorkspaceApiKey";
      workspaceId: string;
      id: string;
      name: string;
      start?: string | null;
      prefix?: string | null;
      enabled: boolean;
      permissions: Array<WorkspaceApiKeyPermission>;
      createdAt: any;
      lastUsedAt?: any | null;
      expiresAt?: any | null;
    };
  };
};

export type UpdateWorkspaceApiKeyFromApiKeysRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateWorkspaceApiKeyInput;
}>;

export type UpdateWorkspaceApiKeyFromApiKeysRouteMutation = {
  __typename?: "Mutation";
  updateWorkspaceApiKey: {
    __typename?: "WorkspaceApiKey";
    workspaceId: string;
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    enabled: boolean;
    permissions: Array<WorkspaceApiKeyPermission>;
    createdAt: any;
    lastUsedAt?: any | null;
    expiresAt?: any | null;
  };
};

export type DeleteWorkspaceApiKeyFromApiKeysRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DeleteWorkspaceApiKeyFromApiKeysRouteMutation = {
  __typename?: "Mutation";
  deleteWorkspaceApiKey: {
    __typename?: "WorkspaceApiKey";
    workspaceId: string;
    id: string;
    name: string;
    start?: string | null;
    prefix?: string | null;
    enabled: boolean;
    permissions: Array<WorkspaceApiKeyPermission>;
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
  currentMember?: {
    __typename?: "Member";
    workspaceId: string;
    id: string;
    roles: Array<WorkspaceRole>;
    permissions: Array<WorkspacePermission>;
    status: MemberStatus;
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

export type SetMemberPermissionsFromMemberRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: SetMemberPermissionsInput;
}>;

export type SetMemberPermissionsFromMemberRouteMutation = {
  __typename?: "Mutation";
  setMemberPermissions: {
    __typename?: "SetMemberPermissionsPayload";
    id: string;
  };
};

export type UpdateMemberFromMemberRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateMemberInput;
}>;

export type UpdateMemberFromMemberRouteMutation = {
  __typename?: "Mutation";
  updateMember?: { __typename?: "UpdateMemberPayload"; id: string } | null;
};

export type SetMemberRolesFromMemberRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: SetMemberRolesInput;
}>;

export type SetMemberRolesFromMemberRouteMutation = {
  __typename?: "Mutation";
  setMemberRoles: { __typename?: "SetMemberRolesPayload"; id: string };
};

export type GetMemberFromMemberRouteQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type GetMemberFromMemberRouteQuery = {
  __typename?: "Query";
  member?: {
    __typename?: "Member";
    workspaceId: string;
    id: string;
    roles: Array<WorkspaceRole>;
    permissions: Array<WorkspacePermission>;
    status: MemberStatus;
    name: string;
    email?: string | null;
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

export type RemoveMemberFromMemberRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type RemoveMemberFromMemberRouteMutation = {
  __typename?: "Mutation";
  removeMember: { __typename?: "RemoveMemberPayload"; id: string };
};

export type GetRolesFromInviteMemberDialogQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetRolesFromInviteMemberDialogQuery = {
  __typename?: "Query";
  workspaceRoles: Array<{
    __typename?: "WorkspaceRoleOption";
    role: WorkspaceRole;
    grantable: boolean;
  }>;
};

export type CreateInvitationFromInviteMemberDialogMutationVariables = Exact<{
  input: CreateInvitationInput;
}>;

export type CreateInvitationFromInviteMemberDialogMutation = {
  __typename?: "Mutation";
  createInvitation: { __typename?: "CreateInvitationPayload"; id: string };
};

export type GetMembersFromMembersRouteQueryVariables = Exact<{
  after?: InputMaybe<Scalars["String"]["input"]>;
  before?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
  last?: InputMaybe<Scalars["Int"]["input"]>;
  filter?: InputMaybe<Scalars["MemberFilter"]["input"]>;
  orderBy?: InputMaybe<MemberOrder>;
  query?: InputMaybe<Scalars["String"]["input"]>;
  invitationFirst?: InputMaybe<Scalars["Int"]["input"]>;
  invitationLast?: InputMaybe<Scalars["Int"]["input"]>;
  invitationAfter?: InputMaybe<Scalars["String"]["input"]>;
  invitationBefore?: InputMaybe<Scalars["String"]["input"]>;
  invitationFilter?: InputMaybe<Scalars["InvitationFilter"]["input"]>;
  includeInvitations?: Scalars["Boolean"]["input"];
}>;

export type GetMembersFromMembersRouteQuery = {
  __typename?: "Query";
  currentWorkspace?: {
    __typename?: "Workspace";
    members: {
      __typename?: "MemberConnection";
      edges: Array<{
        __typename?: "MemberEdge";
        node: {
          __typename?: "Member";
          workspaceId: string;
          id: string;
          roles: Array<WorkspaceRole>;
          status: MemberStatus;
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
      __typename?: "InvitationConnection";
      edges: Array<{
        __typename?: "InvitationEdge";
        node: {
          __typename?: "Invitation";
          workspaceId: string;
          id: string;
          email: string;
          roles: Array<WorkspaceRole>;
          status: InvitationStatus;
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

export type CancelInvitationFromMembersRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type CancelInvitationFromMembersRouteMutation = {
  __typename?: "Mutation";
  cancelInvitation: { __typename?: "CancelInvitationPayload"; id: string };
};

export type RemoveMemberFromMembersRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type RemoveMemberFromMembersRouteMutation = {
  __typename?: "Mutation";
  removeMember: { __typename?: "RemoveMemberPayload"; id: string };
};

export type UpdateMemberStatusFromMembersRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  input: UpdateMemberInput;
}>;

export type UpdateMemberStatusFromMembersRouteMutation = {
  __typename?: "Mutation";
  updateMember?: { __typename?: "UpdateMemberPayload"; id: string } | null;
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

export type CreateWorkspaceFromCreateWorkspaceRouteMutationVariables = Exact<{
  input: CreateWorkspaceInput;
}>;

export type CreateWorkspaceFromCreateWorkspaceRouteMutation = {
  __typename?: "Mutation";
  createWorkspace: { __typename?: "CreateWorkspacePayload"; id: string };
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

export type GetInvitationFromInviteRouteQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type GetInvitationFromInviteRouteQuery = {
  __typename?: "Query";
  invitation?: {
    __typename?: "Invitation";
    workspaceId: string;
    id: string;
    email: string;
    roles: Array<WorkspaceRole>;
    status: InvitationStatus;
    expiresAt: any;
    workspace: { __typename?: "Workspace"; id: string; name: string };
  } | null;
};

export type AcceptInvitationFromInviteRouteMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type AcceptInvitationFromInviteRouteMutation = {
  __typename?: "Mutation";
  acceptInvitation: {
    __typename?: "AcceptInvitationPayload";
    id: string;
    memberId: string;
    workspaceId: string;
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
export const CreateUserFromUsersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createUserFromUsersRoute" },
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
  CreateUserFromUsersRouteMutation,
  CreateUserFromUsersRouteMutationVariables
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
export const AcceptInvitationFromUserWorkspacesRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "acceptInvitationFromUserWorkspacesRoute" },
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
            name: { kind: "Name", value: "acceptInvitation" },
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
  AcceptInvitationFromUserWorkspacesRouteMutation,
  AcceptInvitationFromUserWorkspacesRouteMutationVariables
>;
export const RejectInvitationFromUserWorkspacesRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "rejectInvitationFromUserWorkspacesRoute" },
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
            name: { kind: "Name", value: "rejectInvitation" },
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
  RejectInvitationFromUserWorkspacesRouteMutation,
  RejectInvitationFromUserWorkspacesRouteMutationVariables
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
  GetApiKeysFromApiKeysRouteQuery,
  GetApiKeysFromApiKeysRouteQueryVariables
>;
export const CreateWorkspaceApiKeyFromApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createWorkspaceApiKeyFromApiKeysRoute" },
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
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "workspaceId" },
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
  CreateWorkspaceApiKeyFromApiKeysRouteMutation,
  CreateWorkspaceApiKeyFromApiKeysRouteMutationVariables
>;
export const UpdateWorkspaceApiKeyFromApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateWorkspaceApiKeyFromApiKeysRoute" },
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
                { kind: "Field", name: { kind: "Name", value: "workspaceId" } },
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
  UpdateWorkspaceApiKeyFromApiKeysRouteMutation,
  UpdateWorkspaceApiKeyFromApiKeysRouteMutationVariables
>;
export const DeleteWorkspaceApiKeyFromApiKeysRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "deleteWorkspaceApiKeyFromApiKeysRoute" },
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
                { kind: "Field", name: { kind: "Name", value: "workspaceId" } },
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
  DeleteWorkspaceApiKeyFromApiKeysRouteMutation,
  DeleteWorkspaceApiKeyFromApiKeysRouteMutationVariables
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
            name: { kind: "Name", value: "currentMember" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "workspaceId" } },
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "roles" } },
                { kind: "Field", name: { kind: "Name", value: "permissions" } },
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
export const SetMemberPermissionsFromMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "setMemberPermissionsFromMemberRoute" },
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
              name: { kind: "Name", value: "SetMemberPermissionsInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "setMemberPermissions" },
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
  SetMemberPermissionsFromMemberRouteMutation,
  SetMemberPermissionsFromMemberRouteMutationVariables
>;
export const UpdateMemberFromMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateMemberFromMemberRoute" },
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
              name: { kind: "Name", value: "UpdateMemberInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateMember" },
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
  UpdateMemberFromMemberRouteMutation,
  UpdateMemberFromMemberRouteMutationVariables
>;
export const SetMemberRolesFromMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "setMemberRolesFromMemberRoute" },
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
              name: { kind: "Name", value: "SetMemberRolesInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "setMemberRoles" },
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
  SetMemberRolesFromMemberRouteMutation,
  SetMemberRolesFromMemberRouteMutationVariables
>;
export const GetMemberFromMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getMemberFromMemberRoute" },
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
            name: { kind: "Name", value: "member" },
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
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
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
  GetMemberFromMemberRouteQuery,
  GetMemberFromMemberRouteQueryVariables
>;
export const RemoveMemberFromMemberRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "removeMemberFromMemberRoute" },
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
            name: { kind: "Name", value: "removeMember" },
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
  RemoveMemberFromMemberRouteMutation,
  RemoveMemberFromMemberRouteMutationVariables
>;
export const GetRolesFromInviteMemberDialogDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getRolesFromInviteMemberDialog" },
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
  GetRolesFromInviteMemberDialogQuery,
  GetRolesFromInviteMemberDialogQueryVariables
>;
export const CreateInvitationFromInviteMemberDialogDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "createInvitationFromInviteMemberDialog" },
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
              name: { kind: "Name", value: "CreateInvitationInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createInvitation" },
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
  CreateInvitationFromInviteMemberDialogMutation,
  CreateInvitationFromInviteMemberDialogMutationVariables
>;
export const GetMembersFromMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getMembersFromMembersRoute" },
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
            name: { kind: "Name", value: "MemberFilter" },
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
            name: { kind: "Name", value: "MemberOrder" },
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
            name: { kind: "Name", value: "InvitationFilter" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includeInvitations" },
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
                            name: { kind: "Name", value: "includeInvitations" },
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
  GetMembersFromMembersRouteQuery,
  GetMembersFromMembersRouteQueryVariables
>;
export const CancelInvitationFromMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "cancelInvitationFromMembersRoute" },
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
            name: { kind: "Name", value: "cancelInvitation" },
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
  CancelInvitationFromMembersRouteMutation,
  CancelInvitationFromMembersRouteMutationVariables
>;
export const RemoveMemberFromMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "removeMemberFromMembersRoute" },
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
            name: { kind: "Name", value: "removeMember" },
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
  RemoveMemberFromMembersRouteMutation,
  RemoveMemberFromMembersRouteMutationVariables
>;
export const UpdateMemberStatusFromMembersRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "updateMemberStatusFromMembersRoute" },
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
              name: { kind: "Name", value: "UpdateMemberInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateMember" },
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
  UpdateMemberStatusFromMembersRouteMutation,
  UpdateMemberStatusFromMembersRouteMutationVariables
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
export const GetInvitationFromInviteRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "getInvitationFromInviteRoute" },
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
            name: { kind: "Name", value: "invitation" },
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
  GetInvitationFromInviteRouteQuery,
  GetInvitationFromInviteRouteQueryVariables
>;
export const AcceptInvitationFromInviteRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "acceptInvitationFromInviteRoute" },
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
            name: { kind: "Name", value: "acceptInvitation" },
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
  AcceptInvitationFromInviteRouteMutation,
  AcceptInvitationFromInviteRouteMutationVariables
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
