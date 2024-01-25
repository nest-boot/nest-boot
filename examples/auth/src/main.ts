import { Logger } from "@nest-boot/logger";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

void (async () => {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = await app.resolve(Logger);

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught rejection exception", { err });
  });

  process.on("unhandledRejection", (err) => {
    logger.error("Unhandled rejection exception", { err });
  });

  app.useLogger(logger);

  app.enableShutdownHooks();

  await app.listen(4000);
})();
