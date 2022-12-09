import {
  DefaultLogger as MikroOrmLogger,
  LogContext as MikroOrmLoggerContext,
  LoggerNamespace as MikroOrmLoggerNamespace,
} from "@mikro-orm/core";
import { Logger } from "@nest-boot/common";

export class DatabaseLogger extends MikroOrmLogger {
  #logger = new Logger("DatabaseModule");

  #log(
    method: "log" | "error" | "warn",
    namespace: MikroOrmLoggerNamespace,
    message: string,
    context?: MikroOrmLoggerContext
  ): void {
    this.#logger[method](`database ${namespace}`, {
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
    this.#log("log", namespace, message, context);
  }

  error(
    namespace: MikroOrmLoggerNamespace,
    message: string,
    context?: MikroOrmLoggerContext
  ): void {
    this.#log("error", namespace, message, context);
  }

  warn(
    namespace: MikroOrmLoggerNamespace,
    message: string,
    context?: MikroOrmLoggerContext
  ): void {
    this.#log("warn", namespace, message, context);
  }

  logQuery(context: MikroOrmLoggerContext): void {
    this.#logger.log("database query", context);
  }
}
