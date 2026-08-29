import { type Logger as PinoLogger } from "pino";

let configuredLogger: PinoLogger | undefined;

/** Returns the logger configured by the active LoggerModule. @internal */
export function getConfiguredLogger(): PinoLogger | undefined {
  return configuredLogger;
}

/** Stores the logger configured by the active LoggerModule. @internal */
export function setConfiguredLogger(logger: PinoLogger): void {
  configuredLogger = logger;
}
