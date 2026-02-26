import { Type } from "@nestjs/common";
import { NestMiddleware, RouteInfo } from "@nestjs/common/interfaces";

import { MiddlewareManager } from "./middleware.manager";
import { MiddlewareInstanceOrFunction } from "./types";

/**
 * Configurator for applying middlewares to routes.
 * Allows specifying routes, exclusions, and dependencies for the middleware.
 */
export class MiddlewareConfigurator {
  private disabledGlobalExcludeRoutes = false;

  private readonly excludeRoutes: (string | RouteInfo)[] = [];

  private readonly dependencyMiddlewares: Type<NestMiddleware>[] = [];

  /**
   * @internal
   */
  constructor(
    private readonly manager: MiddlewareManager,
    private readonly middlewares: MiddlewareInstanceOrFunction[],
  ) {}

  /**
   * Disables globally configured exclude routes for this middleware.
   */
  public disableGlobalExcludeRoutes(): this {
    this.disabledGlobalExcludeRoutes = true;
    return this;
  }

  /**
   * Excludes routes from the middleware application.
   * @param routes - Routes to exclude.
   */
  public exclude(...routes: (string | RouteInfo)[]): this {
    this.excludeRoutes.push(...routes);
    return this;
  }

  /**
   * Specifies middleware dependencies that should run before this middleware.
   * @param dependencyMiddlewares - The middleware classes that this middleware depends on.
   */
  public dependencies(...dependencyMiddlewares: Type<NestMiddleware>[]): this {
    this.dependencyMiddlewares.push(...dependencyMiddlewares);
    return this;
  }

  /**
   * Applies the middleware to the specified routes.
   * @param routes - Routes to apply the middleware to.
   * @returns The MiddlewareManager instance.
   */
  public forRoutes(
    ...routes: (string | Type | RouteInfo)[]
  ): MiddlewareManager {
    if (routes.length === 0) {
      return this.manager;
    }

    this.middlewares.forEach((middleware) => {
      this.manager.middlewareConfigMap.set(middleware, {
        middleware: (req, res, next) => {
          if ("use" in middleware) {
            middleware.use(req, res, next);
          } else {
            middleware(req, res, next);
          }
        },
        routes,
        excludeRoutes: this.excludeRoutes,
        dependencyMiddlewares: this.dependencyMiddlewares,
        disabledGlobalExcludeRoutes: this.disabledGlobalExcludeRoutes,
      });
    });

    return this.manager;
  }
}
