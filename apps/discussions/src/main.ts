import { Logger } from "@nest-boot/logger";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

void (async () => {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(await app.resolve(Logger));

  app.enableShutdownHooks();

  await app.listen(3000);
})();
