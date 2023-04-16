import { Logger } from "@nest-boot/logger";
import { QueueManager } from "@nest-boot/queue";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { ScheduleService } from "@nest-boot/schedule";

void (async () => {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(await app.resolve(Logger));

  app.enableShutdownHooks();

  await app.listen(3000);

  await app.get(ScheduleService).run();

  await app.get(QueueManager).run();
})();
