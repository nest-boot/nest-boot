import { RouteInfo, Type } from "@nestjs/common/interfaces";
import { BetterAuthOptions } from "better-auth";

import { MikroOrmAdapterConfig } from "./adapters/mikro-orm-adapter";

export interface AuthModuleMiddlewareOptions {
  includeRoutes?: (string | RouteInfo | Type)[];
  excludeRoutes?: (string | RouteInfo)[];
}

export interface AuthModuleOptions extends Omit<BetterAuthOptions, "database"> {
  basePath?: string;

  entities: MikroOrmAdapterConfig["entities"];

  middleware?: AuthModuleMiddlewareOptions;
}
