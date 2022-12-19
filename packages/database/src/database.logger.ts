import {
  DefaultLogger as MikroOrmLogger,
  LogContext as MikroOrmLoggerContext,
  LoggerNamespace as MikroOrmLoggerNamespace,
} from "@mikro-orm/core";
import { LoggerOptions } from "@mikro-orm/core/logging/Logger";
import { Logger } from "@nestjs/common";

export class DatabaseLogger extends MikroOrmLogger {
  constructor(options: LoggerOptions, private readonly logger: Logger) {
    super(options);
  }

  private _log(
    method: "log" | "error" | "warn",
    namespace: MikroOrmLoggerNamespace,
    message: string,
    context?: MikroOrmLoggerContext
  ): void {
    this.logger[method](`database ${namespace}`, {
      message:
        namespace === "discovery" && /^- /.test(message)
          ? message.replace(/^- /, "")
          : message,
      ...(typeof context !== "undefined" ? context : {}),
    });
  }

  log(
    namespace: MikroOrmLoggerNamespace,
    message: string,
    context?: MikroOrmLoggerContext
  ): void {
    this._log("log", namespace, message, context);
  }

  error(
    namespace: MikroOrmLoggerNamespace,
    message: string,
    context?: MikroOrmLoggerContext
  ): void {
    this._log("error", namespace, message, context);
  }

  warn(
    namespace: MikroOrmLoggerNamespace,
    message: string,
    context?: MikroOrmLoggerContext
  ): void {
    this._log("warn", namespace, message, context);
  }

  logQuery(context: MikroOrmLoggerContext): void {
    this.logger.log("database query", context);
  }
}
