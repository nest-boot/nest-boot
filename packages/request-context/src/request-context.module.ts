import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";

import { RequestContext } from "./request-context";
import { RequestContextMiddleware } from "./request-context.middleware";

@Global()
@Module({
  providers: [DiscoveryService, RequestContext],
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
