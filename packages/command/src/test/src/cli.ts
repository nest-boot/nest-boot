import { CommandFactory } from "@nest-boot/command";

import { AppModule } from "./app/app.module.js";

/** Boots the test application and executes its command. */
async function bootstrap() {
  // Let module evaluation finish before bootstrap and its dynamic imports.
  await new Promise((resolve) => setTimeout(resolve, 10));
  await CommandFactory.run(AppModule);
}

void bootstrap();
