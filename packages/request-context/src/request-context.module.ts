import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { RequestContextMiddleware } from "./request-context.middleware";

@Global()
@Module({})
export class RequestContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
