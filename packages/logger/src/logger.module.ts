import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import { Inject, Module, type OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import pino from "pino";

import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  PINO_LOGGER,
} from "./logger.module-definition";
import { Logger } from "./logger.service";
import { LoggerModuleOptions } from "./logger-module-options.interface";

@Module({
  imports: [RequestContextModule],
  providers: [Logger],
  exports: [Logger],
})
export class LoggerModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: LoggerModuleOptions
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    RequestContext.registerMiddleware(async (ctx, next) => {
      ctx.set(
        PINO_LOGGER,
        pino().child({
          reqId: await (this.options?.genReqId ?? randomUUID)(ctx),
        })
      );

      await next?.();
    });
  }
}
