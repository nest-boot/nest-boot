import { Logger } from "@nest-boot/logger";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

const logger = new Logger();

void (async () => {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(logger);

  app.enableShutdownHooks();

  await app.listen(3000);
})();
