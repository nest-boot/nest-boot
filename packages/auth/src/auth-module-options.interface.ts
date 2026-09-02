import type { EntityClass } from "@mikro-orm/core";
import type { Type } from "@nestjs/common";
import type { RouteInfo } from "@nestjs/common/interfaces/middleware/middleware-configuration.interface.js";
import type { BetterAuthOptions } from "better-auth";

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
import type { BuildAbilityCallback } from "./types/build-ability-callback.type.js";

type BetterAuthEmailAndPasswordOptions = NonNullable<
  BetterAuthOptions["emailAndPassword"]
>;
type BetterAuthEmailVerificationOptions = NonNullable<
  BetterAuthOptions["emailVerification"]
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

/** Options for configuring auth middleware route registration. */
export interface AuthModuleMiddlewareOptions {
  /** Whether to register the auth middleware (defaults to true). */
  register?: boolean;
  /** Routes to include in auth middleware processing. */
  includeRoutes?: (string | RouteInfo | Type)[];
  /** Routes to exclude from auth middleware processing. */
  excludeRoutes?: (string | RouteInfo)[];
}

/** Configuration options for the AuthModule. */
export interface AuthModuleOptions extends Omit<
  BetterAuthOptions,
  "database" | "emailAndPassword" | "emailVerification"
> {
  /** Base path for the auth API endpoints. */
  basePath?: string;

  /** Email and password authentication options. */
  emailAndPassword?: AuthModuleEmailAndPasswordOptions;

  /** Email verification delivery and lifecycle options. */
  emailVerification?: AuthModuleEmailVerificationOptions;

  /** Entity classes used for authentication and workspace access. */
  entities: {
    /** User entity class. */
    user: EntityClass<BaseUser>;
    /** Account entity class. */
    account: EntityClass<BaseAccount>;
    /** Session entity class. */
    session: EntityClass<BaseSession>;
    /** Verification entity class. */
    verification: EntityClass<BaseVerification>;
    /** Workspace entity class. */
    workspace: EntityClass<BaseWorkspace>;
    /** Workspace-invitation entity class. */
    workspaceInvitation: EntityClass<BaseWorkspaceInvitation>;
    /** Workspace-member entity class. */
    workspaceMember: EntityClass<BaseWorkspaceMember>;
    /** API key entity class. */
    apiKey: EntityClass<BaseApiKey>;
  };

  /** Middleware registration options. */
  middleware?: AuthModuleMiddlewareOptions;

  /** Builds the workspace-scoped CASL permission ability for the current request. */
  buildWorkspaceAbility?: BuildAbilityCallback;

  /** Builds the user-scoped CASL permission ability for the current request. */
  buildUserAbility?: BuildAbilityCallback;

  /** Callback invoked after successful authentication. */
  onAuthenticated?: () => void | Promise<void>;
}
