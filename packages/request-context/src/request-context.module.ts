import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { RequestContextInterceptor } from "./request-context.interceptor";
import { RequestContextMiddleware } from "./request-context.middleware";

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
