import { type Options } from "pino-http";

/**
 * Logger options supported by {@link LoggerModule}.
 *
 * Pino is an implementation detail. Only the options needed to control HTTP
 * logging, request IDs, output, serialization, formatting, timestamps, and
 * redaction are part of the public API.
 */
export type LoggerModuleOptions = Pick<
  Options,
  | "autoLogging"
  | "enabled"
  | "formatters"
  | "genReqId"
  | "redact"
  | "serializers"
  | "stream"
  | "timestamp"
>;
