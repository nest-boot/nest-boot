import { LoggerService } from "@nestjs/common";
import pino from "pino";

import { defaultPinoOptions } from "./default-pino-options";

class Logger implements LoggerService {
  private readonly pino = pino(defaultPinoOptions);

  log(message: string, context?: string): void {
    this.pino.info({ context }, message);
  }

  error(message: string, trace?: string, context?: string): void {
    this.pino.error({ context, trace }, message);
  }

  warn(message: string, context?: string): void {
    this.pino.warn({ context }, message);
  }

  debug(message: string, context?: string): void {
    this.pino.debug({ context }, message);
  }

  verbose(message: string, context?: string): void {
    this.pino.verbose({ context }, message);
  }
}

export const logger = new Logger();
