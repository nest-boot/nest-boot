import { type Options } from "pino-http";

/**
 * Logger options supported by {@link LoggerModule}.
 *
 * @remarks
 * Pino is an implementation detail. Only the options needed to control HTTP
 * logging, output, serialization, formatting, timestamps, and redaction are
 * part of the public API.
 */
export type LoggerModuleOptions = Pick<
  Options,
  | "autoLogging"
  | "enabled"
  | "formatters"
  | "redact"
  | "serializers"
  | "stream"
  | "timestamp"
>;
