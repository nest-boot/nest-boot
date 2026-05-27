import { NestMiddleware, RouteInfo, Type } from "@nestjs/common/interfaces";

import { MiddlewareFunction } from "../types";

/**
 * Configuration for a middleware.
 * @internal
 */
export interface MiddlewareConfig {
  /** The middleware function to execute */
  middleware: MiddlewareFunction;
  /** Routes to apply the middleware to */
  routes: (string | Type | RouteInfo)[];
  /** Routes to exclude from the middleware */
  excludeRoutes: (string | RouteInfo)[];
  /** Middlewares that must be registered and applied before this one */
  dependencyMiddlewares: Type<NestMiddleware>[];
  /** Middlewares that should be applied before this one when registered */
  afterMiddlewares: Type<NestMiddleware>[];
  /** Middlewares that should be applied after this one when registered */
  beforeMiddlewares: Type<NestMiddleware>[];
  /** Whether to disable global exclude routes for this middleware */
  disabledGlobalExcludeRoutes: boolean;
}
