import { RouteInfo, Type } from "@nestjs/common/interfaces";

import { AuthRlsContext } from "./auth-rls.context";

export interface AuthRlsModuleMiddlewareOptions {
  register?: boolean;
  includeRoutes?: (string | RouteInfo | Type)[];
  excludeRoutes?: (string | RouteInfo)[];
}

export interface AuthRlsModuleOptions {
  context?: (ctx: AuthRlsContext) => AuthRlsContext | Promise<AuthRlsContext>;

  middleware?: AuthRlsModuleMiddlewareOptions;
}
