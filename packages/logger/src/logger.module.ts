import {
  REQUEST,
  RequestContext,
  RequestContextModule,
  RESPONSE,
} from "@nest-boot/request-context";
import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnModuleInit,
  Optional,
  type Provider,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { randomUUID } from "crypto";
import { type Request, type Response } from "express";
import pinoHttp, { type HttpLogger, type Options } from "pino-http";

import { Logger } from "./logger";
import { LoggingInterceptor } from "./logger.interceptor";
import {
  ASYNC_OPTIONS_TYPE,
  BINDINGS,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  PINO_HTTP,
  PINO_LOGGER,
} from "./logger.module-definition";
import { LoggerModuleOptions } from "./logger-module-options.interface";

const pinoHttpProvider: Provider<HttpLogger> = {
  provide: PINO_HTTP,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options?: LoggerModuleOptions) =>
    createLoggerMiddleware(options),
};

/**
 * Structured logging module powered by Pino.
 *
 * @remarks
 * Provides request-scoped structured logging with automatic request correlation,
 * HTTP logging via pino-http, and a global logging interceptor.
 */
@Global()
@Module({
  imports: [RequestContextModule],
  providers: [
    pinoHttpProvider,
    Logger,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [Logger],
})
export class LoggerModule
  extends ConfigurableModuleClass
  implements OnModuleInit
{
  /** Complete options passed to the internal pino-http implementation. */
  private readonly options: Options;

  /** Configured pino-http middleware shared by all logger paths. @internal */
  @Optional()
  @Inject(PINO_HTTP)
  private loggerMiddleware?: HttpLogger;

  /**
   * Registers the LoggerModule with the given options.
   * @param options - Supported logger configuration options
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the LoggerModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }

  /** Creates a new LoggerModule instance.
   * @param options - Supported logger configuration options
   */
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    options: LoggerModuleOptions = {},
  ) {
    super();

    this.options = createLoggerOptions(options);
  }

  /** Sets up the pino-http logger and registers it in the request context middleware. */
  onModuleInit(): void {
    const loggerMiddleware =
      this.loggerMiddleware ?? (this.loggerMiddleware = pinoHttp(this.options));
    const logger = loggerMiddleware.logger;

    RequestContext.registerMiddleware("logger", async (ctx, next) => {
      const req = ctx.get<Request>(REQUEST);
      const res = ctx.get<Response>(RESPONSE);

      if (typeof req !== "undefined" && typeof res !== "undefined") {
        loggerMiddleware(req, res);
        ctx.set(
          PINO_LOGGER,
          req.log.child({ ctx: { id: ctx.id, type: ctx.type } }),
        );
      } else {
        ctx.set(
          PINO_LOGGER,
          logger.child({
            ctx: { id: ctx.id, type: ctx.type },
          }),
        );
      }

      return await next();
    });
  }
}

function createLoggerMiddleware(options?: LoggerModuleOptions): HttpLogger {
  return pinoHttp(createLoggerOptions(options));
}

function createLoggerOptions(options: LoggerModuleOptions = {}): Options {
  return {
    autoLogging: {
      ignore: (req) =>
        process.env.NODE_ENV !== "production" &&
        req.headers["x-logging"] === "false",
      ...(typeof options.autoLogging !== "boolean" ? options.autoLogging : {}),
    },
    redact: ["req.headers.authorization", "req.headers.cookie"],
    genReqId: () => RequestContext.id ?? randomUUID(),
    customReceivedMessage: () => "request received",
    customProps: () =>
      RequestContext.isActive() ? (RequestContext.get(BINDINGS) ?? {}) : {},
    ...options,
  };
}
