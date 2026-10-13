import { CommandFactory } from "@nest-boot/command";

import { AppModule } from "./app.module.js";

/** Starts the test application using the same entry point as a user project. */
async function bootstrap() {
  await CommandFactory.run(AppModule);
}

void bootstrap();
