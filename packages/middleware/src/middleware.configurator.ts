import { Type } from "@nestjs/common";
import { NestMiddleware, RouteInfo } from "@nestjs/common/interfaces";

import { MiddlewareManager } from "./middleware.manager";

export class MiddlewareConfigurator {
  private disabledGlobalExcludeRoutes = false;

  private readonly excludeRoutes: (string | RouteInfo)[] = [];

  private readonly dependencyMiddlewares: Type<NestMiddleware>[] = [];

  constructor(
    private readonly manager: MiddlewareManager,
    private readonly middlewares: (NestMiddleware | NestMiddleware["use"])[],
  ) {}

  public disableGlobalExcludeRoutes(): this {
    this.disabledGlobalExcludeRoutes = true;
    return this;
  }

  public exclude(...routes: (string | RouteInfo)[]): this {
    this.excludeRoutes.push(...routes);
    return this;
  }

  public dependencies(...dependencyMiddlewares: Type<NestMiddleware>[]): this {
    this.dependencyMiddlewares.push(...dependencyMiddlewares);
    return this;
  }

  public forRoutes(
    ...routes: (string | Type | RouteInfo)[]
  ): MiddlewareManager {
    if (routes.length === 0) {
      return this.manager;
    }

    this.middlewares.forEach((middleware) => {
      this.manager.middlewareConfigMap.set(middleware, {
        middleware: (req, res, next) =>
          "use" in middleware
            ? middleware.use(req, res, next)
            : middleware(req, res, next),
        routes,
        excludeRoutes: this.excludeRoutes,
        dependencyMiddlewares: this.dependencyMiddlewares,
        disabledGlobalExcludeRoutes: this.disabledGlobalExcludeRoutes,
      });
    });

    return this.manager;
  }
}
