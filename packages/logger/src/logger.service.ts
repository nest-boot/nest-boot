import { Injectable, LoggerService, Scope } from "@nestjs/common";
import { Bindings, Level } from "pino";

import { RequestLogger } from "./request-logger.service";

@Injectable({ scope: Scope.TRANSIENT })
export class Logger implements LoggerService {
  private context?: string;

  constructor(public logger: RequestLogger) {}

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
    this.logger.assign(bindings);
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
