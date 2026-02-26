import { TransactionOptions } from "@mikro-orm/core";
import { RouteInfo, Type } from "@nestjs/common/interfaces";

/**
 * Options for configuring middleware for RequestTransactionModule.
 */
export interface RequestTransactionModuleMiddlewareOptions {
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
 * Options for configuring the RequestTransactionModule.
 * Extends MikroORM TransactionOptions.
 */
export interface RequestTransactionModuleOptions extends TransactionOptions {
  /**
   * Configuration for the middleware.
   */
  middleware?: RequestTransactionModuleMiddlewareOptions;
}
