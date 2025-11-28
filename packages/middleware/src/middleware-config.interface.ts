import { NestMiddleware, RouteInfo, Type } from "@nestjs/common/interfaces";

export interface MiddlewareConfig {
  middleware: NestMiddleware["use"];
  routes: (string | Type | RouteInfo)[];
  excludeRoutes: (string | RouteInfo)[];
  dependencyMiddlewares: Type<NestMiddleware>[];
  disabledGlobalExcludeRoutes: boolean;
}
