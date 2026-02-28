import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { RequestContextInterceptor } from "./request-context.interceptor";
import { RequestContextMiddleware } from "./request-context.middleware";

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
