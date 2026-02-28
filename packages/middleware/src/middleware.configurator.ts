import { Type } from "@nestjs/common";
import { NestMiddleware, RouteInfo } from "@nestjs/common/interfaces";

import { MiddlewareManager } from "./middleware.manager";
import { MiddlewareInstanceOrFunction } from "./types";

/**
 * Fluent configurator for applying middlewares to routes.
 *
 * @remarks
 * Provides a chainable API for specifying route patterns, exclusions,
 * and dependency ordering when registering middleware.
 */
export class MiddlewareConfigurator {
  /** Whether global route exclusions are disabled for these middlewares. @internal */
  private disabledGlobalExcludeRoutes = false;

  /** Routes excluded from middleware processing. @internal */
  private readonly excludeRoutes: (string | RouteInfo)[] = [];

  /** Middleware types that must run before this middleware. @internal */
  private readonly dependencyMiddlewares: Type<NestMiddleware>[] = [];

  /**
   * Creates a new MiddlewareConfigurator instance.
   * @param manager - The middleware manager that owns this configurator
   * @param middlewares - The middleware instances or functions to configure
   */
  constructor(
    private readonly manager: MiddlewareManager,
    private readonly middlewares: MiddlewareInstanceOrFunction[],
  ) {}

  /**
   * Disables global route exclusions for these middlewares.
   * @returns This configurator for chaining
   */
  public disableGlobalExcludeRoutes(): this {
    this.disabledGlobalExcludeRoutes = true;
    return this;
  }

  /**
   * Excludes specific routes from middleware processing.
   * @param routes - Route patterns or RouteInfo objects to exclude
   * @returns This configurator for chaining
   */
  public exclude(...routes: (string | RouteInfo)[]): this {
    this.excludeRoutes.push(...routes);
    return this;
  }

  /**
   * Declares middleware dependencies for ordering.
   * @param dependencyMiddlewares - Middleware types that must run before this middleware
   * @returns This configurator for chaining
   */
  public dependencies(...dependencyMiddlewares: Type<NestMiddleware>[]): this {
    this.dependencyMiddlewares.push(...dependencyMiddlewares);
    return this;
  }

  /**
   * Applies the configured middlewares to the specified routes.
   * @param routes - Route patterns, controller types, or RouteInfo objects
   * @returns The parent {@link MiddlewareManager} for further configuration
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
