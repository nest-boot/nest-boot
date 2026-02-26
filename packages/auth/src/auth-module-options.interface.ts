import { RouteInfo, Type } from "@nestjs/common/interfaces";
import { BetterAuthOptions } from "better-auth";

import { MikroOrmAdapterConfig } from "./adapters/mikro-orm-adapter";

/**
 * Options for configuring the authentication middleware.
 */
export interface AuthModuleMiddlewareOptions {
  /**
   * Whether to register the middleware.
   */
  register?: boolean;

  /**
   * Routes to include for the middleware.
   */
  includeRoutes?: (string | RouteInfo | Type)[];

  /**
   * Routes to exclude from the middleware.
   */
  excludeRoutes?: (string | RouteInfo)[];
}

/**
 * Options for configuring the AuthModule.
 */
export interface AuthModuleOptions extends Omit<BetterAuthOptions, "database"> {
  /**
   * Base path for authentication routes.
   */
  basePath?: string;

  /**
   * MikroORM adapter configuration for entities.
   */
  entities: MikroOrmAdapterConfig["entities"];

  /**
   * Configuration for authentication middleware.
   */
  middleware?: AuthModuleMiddlewareOptions;

  /**
   * Callback function executed when a user is authenticated.
   */
  onAuthenticated?: () => void | Promise<void>;
}
