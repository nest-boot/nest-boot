import type { EntityClass } from "@mikro-orm/core";
import { Type } from "@nestjs/common";
import type { RouteInfo } from "@nestjs/common/interfaces/middleware/middleware-configuration.interface.js";
import { BetterAuthOptions } from "better-auth";

import type {
  BaseAccount,
  BaseSession,
  BaseUser,
  BaseVerification,
} from "./entities/index.js";
import type {
  AuthApiKeyEntity,
  AuthWorkspaceEntity,
  AuthWorkspaceMemberEntity,
} from "./interfaces/auth-entities.interface.js";
import type { BuildAbilityCallback } from "./types/build-ability-callback.type.js";

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
export interface AuthModuleOptions extends Omit<BetterAuthOptions, "database"> {
  /** Base path for the auth API endpoints. */
  basePath?: string;

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
    workspace: EntityClass<AuthWorkspaceEntity>;
    /** Workspace-member entity class. */
    workspaceMember: EntityClass<AuthWorkspaceMemberEntity>;
    /** API key entity class. */
    apiKey: EntityClass<AuthApiKeyEntity>;
  };

  /** Middleware registration options. */
  middleware?: AuthModuleMiddlewareOptions;

  /** Builds the CASL permission ability for the current request. */
  buildAbility?: BuildAbilityCallback;

  /** Callback invoked after successful authentication. */
  onAuthenticated?: () => void | Promise<void>;
}
