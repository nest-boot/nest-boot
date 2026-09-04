import type { EntityClass } from "@mikro-orm/core";
import type { Type } from "@nestjs/common";
import type { RouteInfo } from "@nestjs/common/interfaces/middleware/middleware-configuration.interface.js";
import type { BetterAuthOptions } from "better-auth";
import type { GenericOAuthConfig } from "better-auth/plugins";

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

type BetterAuthEmailAndPasswordOptions = NonNullable<
  BetterAuthOptions["emailAndPassword"]
>;
type BetterAuthEmailVerificationOptions = NonNullable<
  BetterAuthOptions["emailVerification"]
>;
type BetterAuthUserOptions = NonNullable<BetterAuthOptions["user"]>;
type SupportedBetterAuthOptions = Pick<
  BetterAuthOptions,
  | "account"
  | "advanced"
  | "appName"
  | "basePath"
  | "baseURL"
  | "databaseHooks"
  | "disabledPaths"
  | "hooks"
  | "logger"
  | "onAPIError"
  | "rateLimit"
  | "secrets"
  | "secondaryStorage"
  | "secret"
  | "session"
  | "telemetry"
  | "trustedOrigins"
  | "verification"
>;

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

/** Email and password authentication options owned by AuthModule. */
export interface AuthModuleEmailAndPasswordOptions extends Omit<
  BetterAuthEmailAndPasswordOptions,
  "enabled" | "requireEmailVerification" | "sendResetPassword"
> {
  /** Whether email and password authentication is enabled. Defaults to true. */
  enabled?: boolean;
  /** Whether users must verify their email before signing in. Defaults to true. */
  requireEmailVerification?: boolean;
  /** Custom password reset sender. Defaults to the injected Mailer implementation. */
  sendResetPassword?: AuthSendResetPassword;
}

/** Email verification options owned by AuthModule. */
export interface AuthModuleEmailVerificationOptions extends Omit<
  BetterAuthEmailVerificationOptions,
  "sendVerificationEmail"
> {
  /** Custom verification sender. Defaults to the injected Mailer implementation. */
  sendVerificationEmail?: AuthSendVerificationEmail;
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
> extends BetterAuthUserOptions {
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

/** Better Auth's built-in social-provider configuration map. */
export type AuthModuleSocialProviders = NonNullable<
  BetterAuthOptions["socialProviders"]
>;

/** One built-in social provider registered through AuthModule. */
export type AuthModuleSocialProvider = {
  [ProviderId in keyof AuthModuleSocialProviders]-?: Exclude<
    NonNullable<AuthModuleSocialProviders[ProviderId]>,
    (...args: never[]) => unknown
  > & {
    /** Built-in provider identifier. */
    id: ProviderId;
  };
}[keyof AuthModuleSocialProviders];

/** One custom OAuth 2.0 or OpenID Connect provider. */
export type AuthModuleOAuthProvider = Omit<GenericOAuthConfig, "providerId"> & {
  /** Custom provider identifier. */
  id: string;
};

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
> extends SupportedBetterAuthOptions {
  /** Base path for the auth API endpoints. */
  basePath?: string;

  /** Email and password authentication options. */
  emailAndPassword?: AuthModuleEmailAndPasswordOptions;

  /** User lifecycle, roles, permissions, and authorization ability. */
  user?: AuthModuleUserOptions<UserPermission, User>;

  /** Email verification delivery and lifecycle options. */
  emailVerification?: AuthModuleEmailVerificationOptions;

  /** Workspace lifecycle and invitation-delivery options. */
  workspace?: AuthModuleWorkspaceOptions<WorkspacePermission, Workspace>;

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

  /** Callback invoked after successful authentication. */
  onAuthenticated?: () => void | Promise<void>;
}
