import {
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { RequestContextInterceptor } from "./request-context.interceptor";
import { RequestContextMiddleware } from "./request-context.middleware";

@Global()
@Module({
  providers: [
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [RequestContextMiddleware],
})
export class RequestContextModule implements NestModule {
  constructor(
    private readonly requestContextMiddleware: RequestContextMiddleware,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(this.requestContextMiddleware.use).forRoutes("*");
  }
}
