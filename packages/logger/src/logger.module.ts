import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { LoggerMiddleware } from "./logger.middleware";
import { ConfigurableModuleClass } from "./logger.module-definition";
import { Logger } from "./logger.service";

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class LoggerModule
  extends ConfigurableModuleClass
  implements NestModule
{
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
