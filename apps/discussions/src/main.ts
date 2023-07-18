import { Logger } from "@nest-boot/logger";
import { QueueManager } from "@nest-boot/queue";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

void (async () => {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = await app.resolve(Logger);

  process.on("unhandledRejection", (err) => {
    logger.error("发生未处理的拒绝", { err });
  });

  app.useLogger(logger);

  app.enableShutdownHooks();

  await app.listen(3000, () => {
    logger.log("server started");
  });

  app.get(QueueManager).run();
})();
