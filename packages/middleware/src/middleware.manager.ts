import { Injectable, NestMiddleware, Type } from "@nestjs/common";
import { MiddlewareConsumer, RouteInfo } from "@nestjs/common/interfaces";

import { MiddlewareConfigurator } from "./middleware.configurator";

export interface MiddlewareConfig {
  middleware: NestMiddleware["use"];
  routes: (string | Type | RouteInfo)[];
  excludeRoutes: (string | RouteInfo)[];
  dependencyMiddlewares: Type<NestMiddleware>[];
}

@Injectable()
export class MiddlewareManager {
  public readonly middlewareConfigMap = new Map<
    NestMiddleware | NestMiddleware["use"],
    MiddlewareConfig
  >();

  private get middlewareConfigs(): MiddlewareConfig[] {
    const sorted: (NestMiddleware | NestMiddleware["use"])[] = [];
    const visited = new Set<NestMiddleware | NestMiddleware["use"]>();
    const visiting = new Set<NestMiddleware | NestMiddleware["use"]>();

    const typeToMiddleware = new Map<Type<NestMiddleware>, NestMiddleware>();
    for (const middleware of this.middlewareConfigMap.keys()) {
      if (typeof middleware === "object" && middleware.constructor) {
        typeToMiddleware.set(
          middleware.constructor as Type<NestMiddleware>,
          middleware,
        );
      }
    }

    const visit = (middleware: NestMiddleware | NestMiddleware["use"]) => {
      if (visited.has(middleware)) {
        return;
      }

      if (visiting.has(middleware)) {
        throw new Error("Circular dependency detected in middleware");
      }

      visiting.add(middleware);

      const config = this.middlewareConfigMap.get(middleware);
      if (config?.dependencyMiddlewares) {
        for (const dependencyMiddleware of config.dependencyMiddlewares) {
          const depMiddleware = typeToMiddleware.get(dependencyMiddleware);
          if (!depMiddleware) {
            throw new Error(
              `Dependency middleware ${dependencyMiddleware.name} is not registered`,
            );
          }
          visit(depMiddleware);
        }
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

  apply(...middlewares: (NestMiddleware | NestMiddleware["use"])[]) {
    return new MiddlewareConfigurator(this, middlewares);
  }

  configure(consumer: MiddlewareConsumer) {
    for (const config of this.middlewareConfigs) {
      const proxy = consumer.apply(config.middleware);

      if (config.excludeRoutes.length > 0) {
        proxy.exclude(...config.excludeRoutes);
      }

      proxy.forRoutes(...config.routes);
    }
  }
}
