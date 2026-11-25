import { CommandFactory } from "@nest-boot/command";

import { AppModule } from "./app.module.js";

/** Starts the schedule CLI test application using the user project entry point. */
async function bootstrap() {
  await CommandFactory.run(AppModule);
}

void bootstrap();
