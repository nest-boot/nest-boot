import { Injectable, NestMiddleware, Type } from "@nestjs/common";
import { MiddlewareConsumer, RouteInfo } from "@nestjs/common/interfaces";

import { MiddlewareConfig } from "./interfaces";
import { MiddlewareConfigurator } from "./middleware.configurator";
import { MiddlewareInstanceOrFunction } from "./types";

/**
 * Service that manages middleware registration and topological ordering.
 *
 * @remarks
 * Provides an API similar to NestJS `MiddlewareConsumer` but adds support
 * for dependency-based ordering and global route exclusions.
 */
@Injectable()
export class MiddlewareManager {
  /** Global routes excluded from all middleware processing. @internal */
  private globalExcludeRoutes: (string | RouteInfo)[] = [];

  /** Map of middleware instances to their configurations. @internal */
  public readonly middlewareConfigMap = new Map<
    MiddlewareInstanceOrFunction,
    MiddlewareConfig
  >();

  /** Returns middleware configs sorted by dependency order. @internal */
  private get middlewareConfigs(): MiddlewareConfig[] {
    const sorted: MiddlewareInstanceOrFunction[] = [];
    const visited = new Set<MiddlewareInstanceOrFunction>();
    const visiting = new Set<MiddlewareInstanceOrFunction>();

    const typeToMiddleware = new Map<Type<NestMiddleware>, NestMiddleware>();
    for (const middleware of this.middlewareConfigMap.keys()) {
      if (typeof middleware === "object" && middleware.constructor) {
        typeToMiddleware.set(
          middleware.constructor as Type<NestMiddleware>,
          middleware,
        );
      }
    }

    const resolveDependencyMiddleware = (
      middlewareType: Type<NestMiddleware>,
    ) => {
      const middleware = typeToMiddleware.get(middlewareType);
      if (!middleware) {
        throw new Error(
          `Dependency middleware ${middlewareType.name} is not registered`,
        );
      }
      return middleware;
    };

    const dependencyMap = new Map<
      MiddlewareInstanceOrFunction,
      MiddlewareInstanceOrFunction[]
    >();

    for (const [middleware, config] of this.middlewareConfigMap) {
      dependencyMap.set(
        middleware,
        config.dependencyMiddlewares.map((dependencyMiddleware) =>
          resolveDependencyMiddleware(dependencyMiddleware),
        ),
      );
    }

    for (const [middleware, config] of this.middlewareConfigMap) {
      for (const afterMiddleware of config.afterMiddlewares) {
        const dependency = typeToMiddleware.get(afterMiddleware);
        if (dependency) {
          dependencyMap.get(middleware)?.push(dependency);
        }
      }

      for (const beforeMiddleware of config.beforeMiddlewares) {
        const dependent = typeToMiddleware.get(beforeMiddleware);
        if (dependent) {
          dependencyMap.get(dependent)?.push(middleware);
        }
      }
    }

    const visit = (middleware: MiddlewareInstanceOrFunction) => {
      if (visited.has(middleware)) {
        return;
      }

      if (visiting.has(middleware)) {
        throw new Error("Circular dependency detected in middleware");
      }

      visiting.add(middleware);

      const dependencies = dependencyMap.get(middleware) ?? [];
      for (const dependency of dependencies) {
        visit(dependency);
      }

      visiting.delete(middleware);
      visited.add(middleware);
      sorted.push(middleware);
    };

    for (const middleware of this.middlewareConfigMap.keys()) {
      visit(middleware);
    }

    return sorted
      .map((m) => this.middlewareConfigMap.get(m))
      .filter((config): config is MiddlewareConfig => config !== undefined);
  }

  /**
   * Creates a middleware configurator for the given middlewares.
   * @param middlewares - Middleware instances or functions to apply
   * @returns A {@link MiddlewareConfigurator} for specifying routes and options
   */
  apply(
    ...middlewares: MiddlewareInstanceOrFunction[]
  ): MiddlewareConfigurator {
    return new MiddlewareConfigurator(this, middlewares);
  }

  /**
   * Adds routes to the global exclusion list (applies to all middlewares).
   * @param routes - Route patterns or RouteInfo objects to exclude globally
   * @returns This manager for chaining
   */
  globalExclude(...routes: (string | RouteInfo)[]): this {
    this.globalExcludeRoutes.push(...routes);
    return this;
  }

  /**
   * Applies all registered middleware configurations to the NestJS middleware consumer.
   * @param consumer - The NestJS middleware consumer from the module's configure method
   */
  configure(consumer: MiddlewareConsumer) {
    for (const config of this.middlewareConfigs) {
      const proxy = consumer.apply(config.middleware);

      const excludeRoutes = config.disabledGlobalExcludeRoutes
        ? config.excludeRoutes
        : [...this.globalExcludeRoutes, ...config.excludeRoutes];

      if (excludeRoutes.length > 0) {
        proxy.exclude(...excludeRoutes);
      }

      proxy.forRoutes(...config.routes);
    }
  }
}
