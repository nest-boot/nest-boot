import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { RequestContextMiddleware } from "./middlewares";
import { ConfigurableModuleClass } from "./request-context.module-definition";
import { Logger } from "./services";

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class RequestContextModule
  extends ConfigurableModuleClass
  implements NestModule
{
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
