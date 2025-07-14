import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, type LoggerService, Scope } from "@nestjs/common";
import { INQUIRER } from "@nestjs/core";
import pino, {
  type Bindings,
  type Level,
  type Logger as PinoLogger,
} from "pino";

import { BINDINGS, PINO_LOGGER } from "./logger.module-definition";

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
    RequestContext.set(BINDINGS, {
      ...(RequestContext.get<Bindings>(BINDINGS) ?? {}),
      ...bindings,
    });
  }

  private get pinoLogger(): PinoLogger {
    let pinoLogger: PinoLogger | undefined;

    try {
      pinoLogger = RequestContext.get<PinoLogger>(PINO_LOGGER);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    let bindings: Bindings = {};

    try {
      bindings = RequestContext.get<Bindings>(BINDINGS) ?? {};
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {}

    let context = this.context;

    if (optionalParams.length !== 0) {
      const lastOptionalParam = optionalParams[optionalParams.length - 1];
      if (typeof lastOptionalParam === "string") {
        context = lastOptionalParam;
      }

      if (typeof optionalParams[0] === "object") {
        bindings = { ...bindings, ...optionalParams[0] };
      }
    }

    bindings = { ...bindings, context };

    this.pinoLogger[level](bindings, message);
  }
}
