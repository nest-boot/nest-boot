import { RequestContext } from "@nest-boot/request-context";
import {
  Inject,
  Injectable,
  type LoggerService,
  Optional,
  Scope,
} from "@nestjs/common";
import { INQUIRER } from "@nestjs/core";
import pino, {
  type Bindings,
  type Level,
  type Logger as PinoLogger,
} from "pino";

import {
  BINDINGS,
  PINO_HTTP,
  PINO_LOGGER,
} from "./logger.module-definition.js";
import { type PinoHttpLogger } from "./pino-http.js";

/**
 * Request-scoped structured logger built on top of pino.
 *
 * @remarks
 * Implements the NestJS {@link LoggerService} interface. Each request
 * gets its own logger context via {@link RequestContext}, supporting
 * request-scoped bindings and automatic context propagation.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class Logger implements LoggerService {
  /** Configured pino-http middleware supplied by LoggerModule. @internal */
  @Optional()
  @Inject(PINO_HTTP)
  private readonly loggerMiddleware?: PinoHttpLogger;

  /** Current logging context name. @internal */
  private context?: string;

  /** Fallback pino logger when no request context is active. @internal */
  private globalLogger?: PinoLogger;

  /** Creates a new Logger instance.
   * @param parentClass - The parent class that owns this logger instance
   */
  constructor(@Inject(INQUIRER) private parentClass: object) {
    this.setContext(this.parentClass?.constructor?.name);
  }

  /** Returns the current logger context name. */
  getContext(): string | undefined {
    return this.context;
  }

  /**
   * Sets the context name for this logger instance.
   * @param context - The context name (typically the class name)
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Logs a message at the `trace` level.
   * @param message - Log message
   * @param optionalParams - Additional structured data or context override
   */
  verbose(message: string, ...optionalParams: unknown[]): void {
    this.call("trace", message, ...optionalParams);
  }

  /**
   * Logs a message at the `debug` level.
   * @param message - Log message
   * @param optionalParams - Additional structured data or context override
   */
  debug(message: string, ...optionalParams: unknown[]): void {
    this.call("debug", message, ...optionalParams);
  }

  /**
   * Logs a message at the `info` level.
   * @param message - Log message
   * @param optionalParams - Additional structured data or context override
   */
  log(message: string, ...optionalParams: unknown[]): void {
    this.call("info", message, ...optionalParams);
  }

  /**
   * Logs a message at the `warn` level.
   * @param message - Log message
   * @param optionalParams - Additional structured data or context override
   */
  warn(message: string, ...optionalParams: unknown[]): void {
    this.call("warn", message, ...optionalParams);
  }

  /**
   * Logs a message at the `error` level.
   * @param message - Log message or Error to serialize
   * @param optionalParams - Stack trace, structured data, or context override
   */
  error(message: string | Error, ...optionalParams: unknown[]): void {
    let stack: string | undefined;
    let context = this.context;
    const lastParam = optionalParams.at(-1);

    // A lone string remains a context override unless it looks like a stack.
    // Also accept Nest's stack-last form without treating it as the context.
    if (typeof lastParam === "string" && /\n\s+at\s/.test(lastParam)) {
      stack = optionalParams.pop() as string;
    }
    if (typeof optionalParams.at(-1) === "string") {
      context = optionalParams.pop() as string;
    }
    if (stack === undefined && typeof optionalParams[0] === "string") {
      stack = optionalParams.shift() as string;
    }

    const data = optionalParams[0];
    const bindings: Bindings =
      data instanceof Error
        ? { err: data }
        : typeof data === "object" && data !== null
          ? { ...data }
          : {};
    if (message instanceof Error) bindings.err = message;
    if (stack !== undefined) bindings.stack = stack;

    this.call(
      "error",
      message instanceof Error ? message.message : message,
      bindings,
      context,
    );
  }

  /**
   * Merges additional bindings into the current request's log context.
   * @param bindings - Key-value pairs to add to log output
   */
  assign(bindings: Bindings): void {
    RequestContext.set(BINDINGS, {
      ...(RequestContext.get<Bindings>(BINDINGS) ?? {}),
      ...bindings,
    });
  }

  /** Gets the current pino logger from request context or falls back to global. @internal */
  private get pinoLogger(): PinoLogger {
    let pinoLogger: PinoLogger | undefined;

    try {
      pinoLogger = RequestContext.get<PinoLogger>(PINO_LOGGER);
    } catch {
      //
    }

    if (typeof pinoLogger === "undefined") {
      return (
        this.loggerMiddleware?.logger ??
        this.globalLogger ??
        (this.globalLogger = pino())
      );
    }

    return pinoLogger;
  }

  /** Dispatches a log message at the given level. @internal */
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
