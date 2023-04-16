import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, type LoggerService, Scope } from "@nestjs/common";
import pino, {
  type Bindings,
  type Level,
  type Logger as PinoLogger,
} from "pino";

import { MODULE_OPTIONS_TOKEN, PINO_LOGGER } from "./logger.module-definition";
import { LoggerModuleOptions } from "./logger-module-options.interface";

@Injectable({ scope: Scope.TRANSIENT })
export class Logger implements LoggerService {
  private context?: string;

  private globalLogger?: PinoLogger;

  constructor(@Inject(MODULE_OPTIONS_TOKEN) options: LoggerModuleOptions) {}

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.call("trace", message, ...optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.call("debug", message, ...optionalParams);
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.call("info", message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.call("warn", message, ...optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    this.call("error", message, ...optionalParams);
  }

  assign(bindings: Bindings): void {
    const logger = RequestContext.get<PinoLogger>(PINO_LOGGER);

    if (typeof logger === "undefined") {
      throw new Error(`Unable to assign extra fields out of request scope`);
    }

    RequestContext.set(PINO_LOGGER, logger.child(bindings));
  }

  setContext(context: string): void {
    this.context = context;
  }

  private get pinoLogger(): PinoLogger {
    return (
      RequestContext.get<PinoLogger>(PINO_LOGGER) ??
      this.globalLogger ??
      (this.globalLogger = pino())
    );
  }

  private call(
    level: Level,
    message: string,
    ...optionalParams: unknown[]
  ): void {
    let objArg: Record<string, unknown> = {};

    objArg.context = this.context;

    if (optionalParams.length !== 0) {
      if (typeof optionalParams[optionalParams.length - 1] === "string") {
        objArg.context = optionalParams[optionalParams.length - 1];
      }

      if (typeof optionalParams[0] === "object") {
        objArg = { ...objArg, ...optionalParams[0] };
      }
    }

    this.pinoLogger[level](objArg, message);
  }
}
