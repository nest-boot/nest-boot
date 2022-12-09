import { Injectable, LoggerService, Optional, Scope } from "@nestjs/common";
import pino, { Bindings, Level } from "pino";

import { Context } from "../context";

@Injectable({ scope: Scope.TRANSIENT })
export class Logger implements LoggerService {
  #logger?: pino.Logger;

  constructor(@Optional() private context?: string) {}

  get logger(): pino.Logger {
    if (typeof this.#logger === "undefined") {
      try {
        this.#logger = Context.get<pino.Logger>("pino-logger");
      } catch (err) {}
    }

    if (typeof this.#logger === "undefined") {
      this.#logger = pino();
    }

    return this.#logger;
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
    this.#logger = this.logger.child(bindings);

    let ctxLogger: pino.Logger | undefined;
    try {
      ctxLogger = Context.get<pino.Logger | undefined>("pino-logger");
    } catch (err) {}

    if (typeof ctxLogger !== "undefined") {
      Context.set<pino.Logger>("pino-logger", this.#logger.child(bindings));
    }
  }

  setContext(context: string): void {
    this.context = context;
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

    this.logger[level](objArg, message);
  }
}
