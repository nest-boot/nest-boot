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
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [RequestContext],
})
export class RequestContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
