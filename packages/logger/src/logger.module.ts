import { REQUEST, RequestContext, RESPONSE } from "@nest-boot/request-context";
import {
  Global,
  Inject,
  Module,
  type OnModuleInit,
  Optional,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { type Request, type Response } from "express";
import pino from "pino";
import pinoHttp from "pino-http";

import { Logger } from "./logger";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  PINO_LOGGER,
} from "./logger.module-definition";
import { LoggerModuleOptions } from "./logger-module-options.interface";

@Global()
@Module({
  providers: [Logger],
  exports: [Logger],
})
export class LoggerModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: LoggerModuleOptions = {},
  ) {
    super();
  }

  onModuleInit(): void {
    const logger = pino();
    const loggerMiddleware = pinoHttp({
      autoLogging: false,
      genReqId:
        this.options.genReqId ??
        function (req, res) {
          const id = req.headers["x-request-id"] ?? randomUUID();
          res.setHeader("X-Request-Id", id);
          return id;
        },
      ...this.options,
    });

    RequestContext.registerMiddleware(async (ctx, next) => {
      const req = ctx.get<Request>(REQUEST);
      const res = ctx.get<Response>(RESPONSE);

      if (typeof req !== "undefined" && typeof res !== "undefined") {
        loggerMiddleware(req, res);
        ctx.set(PINO_LOGGER, req.log);
      } else {
        ctx.set(
          PINO_LOGGER,
          logger.child({
            req: { id: randomUUID() },
          }),
        );
      }

      return await next();
    });
  }
}
