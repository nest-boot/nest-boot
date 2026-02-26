import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, type LoggerService, Scope } from "@nestjs/common";
import { INQUIRER } from "@nestjs/core";
import pino, {
  type Bindings,
  type Level,
  type Logger as PinoLogger,
} from "pino";

import { BINDINGS, PINO_LOGGER } from "./logger.module-definition";

/**
 * Enhanced Logger service based on Pino.
 * Can be injected into services to log messages with context.
 * It automatically includes request context information if available.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class Logger implements LoggerService {
  private context?: string;

  private globalLogger?: PinoLogger;

  constructor(@Inject(INQUIRER) private parentClass: object) {
    this.setContext(this.parentClass?.constructor?.name);
  }

  /**
   * Gets the current logger context (usually the class name).
   */
  getContext(): string | undefined {
    return this.context;
  }

  /**
   * Sets the logger context.
   * @param context - The context string.
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Logs a verbose message.
   */
  verbose(message: string, ...optionalParams: unknown[]): void {
    this.call("trace", message, ...optionalParams);
  }

  /**
   * Logs a debug message.
   */
  debug(message: string, ...optionalParams: unknown[]): void {
    this.call("debug", message, ...optionalParams);
  }

  /**
   * Logs an info message.
   */
  log(message: string, ...optionalParams: unknown[]): void {
    this.call("info", message, ...optionalParams);
  }

  /**
   * Logs a warning message.
   */
  warn(message: string, ...optionalParams: unknown[]): void {
    this.call("warn", message, ...optionalParams);
  }

  /**
   * Logs an error message.
   */
  error(message: string, ...optionalParams: unknown[]): void {
    this.call("error", message, ...optionalParams);
  }

  /**
   * Assigns additional bindings (key-value pairs) to the current request's logger context.
   * @param bindings - Object containing properties to log with every subsequent message in this request.
   */
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
    } catch {
      //
    }

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
    } catch {
      //
    }

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
