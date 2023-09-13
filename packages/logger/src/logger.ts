import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, type LoggerService, Scope } from "@nestjs/common";
import { INQUIRER } from "@nestjs/core";
import pino, {
  type Bindings,
  type Level,
  type Logger as PinoLogger,
} from "pino";

import { PINO_LOGGER } from "./logger.module-definition";

@Injectable({ scope: Scope.TRANSIENT })
export class Logger implements LoggerService {
  private context?: string;

  private globalLogger?: PinoLogger;

  constructor(@Inject(INQUIRER) private parentClass: object) {
    this.setContext(this.parentClass?.constructor?.name);
  }

  getContext(): string | undefined {
    return this.context;
  }

  setContext(context: string): void {
    this.context = context;
  }

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

  private get pinoLogger(): PinoLogger {
    let pinoLogger: PinoLogger | undefined;

    try {
      pinoLogger = RequestContext.get<PinoLogger>(PINO_LOGGER);
    } catch (err) {}

    if (typeof pinoLogger === "undefined") {
      return this.globalLogger ?? (this.globalLogger = pino());
    }

    return pinoLogger;
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
