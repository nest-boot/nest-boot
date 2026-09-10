import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import {
  type DynamicModule,
  Global,
  Module,
  type Provider,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { RequestContextInterceptor } from "./request-context.interceptor.js";
import { RequestContext, type RequestContextToken } from "./request-context.js";
import { RequestContextMiddleware } from "./request-context.middleware.js";

@Module({})
class RequestContextFeatureModule {}

const requestContextProxies = new WeakSet<object>();

/**
 * NestJS module that provides request context functionality.
 *
 * This module automatically sets up request context for HTTP requests
 * using both middleware (for Express) and interceptor (for GraphQL).
 * It stores the request and response objects in the context and makes
 * them available throughout the request lifecycle.
 *
 * The module is global, so it only needs to be imported once in the root module.
 *
 * @example
 * ```typescript
 * import { Module } from '@nestjs/common';
 * import { RequestContextModule } from '@nest-boot/request-context';
 *
 * @Module({
 *   imports: [RequestContextModule],
 * })
 * export class AppModule {}
 * ```
 *
 * @example Using in a service
 * ```typescript
 * import { Injectable } from '@nestjs/common';
 * import { RequestContext, REQUEST } from '@nest-boot/request-context';
 * import { Request } from 'express';
 *
 * @Injectable()
 * export class MyService {
 *   getCurrentUser() {
 *     const req = RequestContext.get<Request>(REQUEST);
 *     return req?.user;
 *   }
 * }
 * ```
 */
@Global()
@Module({
  imports: [MiddlewareModule],
  providers: [
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [RequestContextMiddleware],
})
export class RequestContextModule {
  /**
   * Exposes a context value as a singleton NestJS proxy provider.
   *
   * The proxy is registered and exported under the supplied token. Every
   * property read, method call, and property write is delegated to the value
   * returned by `RequestContext.get(token)` for the active context.
   *
   * @typeParam T - The object associated with the token
   * @param token - The request-context token to expose through Nest injection
   * @returns A dynamic module that provides and exports the proxy
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [RequestContextModule.forFeature(CurrentUser)],
   * })
   * export class UsersModule {}
   * ```
   */
  static forFeature<T extends object>(
    token: RequestContextToken<T>,
  ): DynamicModule {
    const provider: Provider<T> = {
      provide: token,
      useValue: createRequestContextProxy(token),
    };

    return {
      module: RequestContextFeatureModule,
      providers: [provider],
      exports: [token],
    };
  }

  /**
   * Creates a new RequestContextModule instance.
   * @param middlewareManager - Middleware manager for registering the context middleware
   * @param requestContextMiddleware - The request context middleware instance
   */
  constructor(
    private readonly middlewareManager: MiddlewareManager,
    private readonly requestContextMiddleware: RequestContextMiddleware,
  ) {
    this.middlewareManager
      .apply(this.requestContextMiddleware)
      .disableGlobalExcludeRoutes()
      .forRoutes("*");
  }
}

/** Creates an object proxy that follows the value in the active context. */
function createRequestContextProxy<T extends object>(
  token: RequestContextToken<T>,
): T {
  function getContextValue(): T | undefined {
    if (!RequestContext.isActive()) {
      return undefined;
    }

    const value = RequestContext.get(token);

    // The Nest dependency resolver may find this provider when no contextual
    // value exists. Treat that circular fallback as an unresolved value.
    return typeof value === "undefined" || requestContextProxies.has(value)
      ? undefined
      : value;
  }

  const proxy = new Proxy(Object.create(null) as object, {
    get(_target, property) {
      const contextValue = getContextValue();

      if (typeof contextValue === "undefined") {
        return undefined;
      }

      const value = Reflect.get(contextValue, property, contextValue);

      return typeof value === "function" ? value.bind(contextValue) : value;
    },
    set(_target, property, value) {
      const contextValue = getContextValue();

      return typeof contextValue === "undefined"
        ? false
        : Reflect.set(contextValue, property, value, contextValue);
    },
  }) as T;

  requestContextProxies.add(proxy);

  return proxy;
}
