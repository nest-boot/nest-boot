import { Inject, Injectable, Scope } from "@nestjs/common";
import { randomUUID } from "crypto";
import pino, { Bindings, Logger as PinoLogger } from "pino";

import { MODULE_OPTIONS_TOKEN } from "./logger.module-definition";
import { LoggerModuleOptions } from "./logger-module-options.interface";

const logger = pino();

@Injectable({ scope: Scope.REQUEST })
export class RequestLogger {
  private logger: PinoLogger;

  constructor(@Inject(MODULE_OPTIONS_TOKEN) options: LoggerModuleOptions) {
    this.logger = logger.child({
      requestId: options?.genReqId ?? randomUUID(),
    });
  }

  fatal(obj: unknown, msg?: string, ...args: any[]): void {
    this.logger.fatal(obj, msg, ...args);
  }

  info(obj: unknown, msg?: string, ...args: any[]): void {
    this.logger.info(obj, msg, ...args);
  }

  warn(obj: unknown, msg?: string, ...args: any[]): void {
    this.logger.warn(obj, msg, ...args);
  }

  error(obj: unknown, msg?: string, ...args: any[]): void {
    this.logger.error(obj, msg, ...args);
  }

  debug(obj: unknown, msg?: string, ...args: any[]): void {
    this.logger.debug(obj, msg, ...args);
  }

  trace(obj: unknown, msg?: string, ...args: any[]): void {
    this.logger.trace(obj, msg, ...args);
  }

  assign(bindings: Bindings): void {
    this.logger = this.logger.child(bindings);
  }
}
