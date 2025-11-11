import { TransactionOptions } from "@mikro-orm/core";
import { RouteInfo, Type } from "@nestjs/common/interfaces";

export interface RequestTransactionModuleMiddlewareOptions {
  register?: boolean;
  includeRoutes?: (string | RouteInfo | Type)[];
  excludeRoutes?: (string | RouteInfo)[];
}

export interface RequestTransactionModuleOptions extends TransactionOptions {
  middleware?: RequestTransactionModuleMiddlewareOptions;
}
