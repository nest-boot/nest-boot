import { Logger } from "@nest-boot/logger";
import { createScheduleServer } from "@nest-boot/schedule";

import { AppModule } from "./app.module";

void (async () => {
  const app = await createScheduleServer(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(await app.resolve(Logger));

  app.enableShutdownHooks();

  await app.start();
})();
