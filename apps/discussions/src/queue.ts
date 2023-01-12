import { Logger } from "@nest-boot/logger";
import { createQueueServer } from "@nest-boot/queue";

import { AppModule } from "./app.module";

const logger = new Logger();

void (async () => {
  const app = await createQueueServer(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(logger);

  app.enableShutdownHooks();

  await app.start();
})();
