import {
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { RequestContext } from "./request-context";
import { RequestContextInterceptor } from "./request-context.interceptor";
import { RequestContextMiddleware } from "./request-context.middleware";

@Global()
@Module({
  providers: [
    RequestContext,
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [RequestContext, RequestContextMiddleware],
})
export class RequestContextModule implements NestModule {
  constructor(
    private readonly requestContextMiddleware: RequestContextMiddleware,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(this.requestContextMiddleware.use).forRoutes("*");
  }
}
