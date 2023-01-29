import { Logger } from "@nest-boot/logger";
import { createQueueServer } from "@nest-boot/queue";

import { AppModule } from "./app.module";

void (async () => {
  const app = await createQueueServer(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(await app.resolve(Logger));

  app.enableShutdownHooks();

  await app.start();
})();
