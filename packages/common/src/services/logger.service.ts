/* eslint-disable no-underscore-dangle */
import { Injectable, LoggerService, Optional } from "@nestjs/common";
import pino, { Bindings, Level } from "pino";

import { Context } from "../context";

@Injectable()
export class Logger implements LoggerService {
  static logger: pino.Logger;

  private __LOGGER__: pino.Logger;

  constructor(
    @Optional()
    private context?: string
  ) {}

  get logger(): pino.Logger {
    if (Context.get()?.logger) {
      return Context.get().logger;
    }

    if (!this.__LOGGER__) {
      this.__LOGGER__ = pino();
    }

    return this.__LOGGER__;
  }

  verbose(message: string, ...optionalParams: unknown[]) {
    this.call("trace", message, ...optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]) {
    this.call("debug", message, ...optionalParams);
  }

  log(message: string, ...optionalParams: unknown[]) {
    this.call("info", message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]) {
    this.call("warn", message, ...optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]) {
    this.call("error", message, ...optionalParams);
  }

  assign(bindings: Bindings) {
    const ctx = Context.get();

    if (ctx) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      ctx.logger = ctx.logger.child(bindings);
    }
  }

  setContext(context: string) {
    this.context = context;
  }

  private call(level: Level, message: string, ...optionalParams: unknown[]) {
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
