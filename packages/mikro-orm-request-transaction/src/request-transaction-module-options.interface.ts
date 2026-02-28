import { TransactionOptions } from "@mikro-orm/core";
import { RouteInfo, Type } from "@nestjs/common/interfaces";

/** Middleware registration options for the request-transaction module. */
export interface RequestTransactionModuleMiddlewareOptions {
  /** Whether to register the transaction middleware automatically. */
  register?: boolean;
  /** Routes to include for transaction wrapping. */
  includeRoutes?: (string | RouteInfo | Type)[];
  /** Routes to exclude from transaction wrapping. */
  excludeRoutes?: (string | RouteInfo)[];
}

/** Configuration options for the request-transaction module. */
export interface RequestTransactionModuleOptions extends TransactionOptions {
  /** Middleware registration options. */
  middleware?: RequestTransactionModuleMiddlewareOptions;
}
