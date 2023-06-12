import {
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  type OnModuleInit,
} from "@nestjs/common";
import { APP_INTERCEPTOR, DiscoveryService } from "@nestjs/core";

import { RequestContext } from "./request-context";
import { RequestContextInterceptor } from "./request-context.interceptor";
import { RequestContextMiddleware } from "./request-context.middleware";

@Global()
@Module({
  providers: [
    DiscoveryService,
    RequestContext,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [RequestContext],
})
export class RequestContextModule implements NestModule, OnModuleInit {
  constructor(private readonly requestContext: RequestContext) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }

  onModuleInit(): void {
    (global as any).__requestContext = this.requestContext;
  }
}
