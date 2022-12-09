import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { ConfigurableModuleClass } from "./common.module-definition";
import { ContextMiddleware, LoggerMiddleware } from "./middlewares";
import { Logger } from "./services";

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class CommonModule
  extends ConfigurableModuleClass
  implements NestModule
{
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContextMiddleware, LoggerMiddleware).forRoutes("*");
  }
}
