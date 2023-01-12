import { Logger } from "@nest-boot/logger";
import { createScheduleServer } from "@nest-boot/schedule";

import { AppModule } from "./app.module";

const logger = new Logger();

void (async () => {
  const app = await createScheduleServer(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(logger);

  app.enableShutdownHooks();

  await app.start();
})();
