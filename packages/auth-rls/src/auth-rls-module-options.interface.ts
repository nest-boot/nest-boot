import { RouteInfo, Type } from "@nestjs/common/interfaces";

import { AuthRlsContext } from "./auth-rls.context";

/**
 * Options for configuring the AuthRLS middleware.
 */
export interface AuthRlsModuleMiddlewareOptions {
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
 * Options for configuring the AuthRlsModule.
 */
export interface AuthRlsModuleOptions {
  /**
   * Function to customize the AuthRlsContext.
   */
  context?: (ctx: AuthRlsContext) => AuthRlsContext | Promise<AuthRlsContext>;

  /**
   * Configuration for the middleware.
   */
  middleware?: AuthRlsModuleMiddlewareOptions;
}
