import { CommandFactory } from '@nest-boot/command';

import { AppModule } from './app/app.module.js';

/** Starts commands using the same module as the HTTP and REPL entries. */
async function bootstrap() {
  await CommandFactory.run(AppModule);
}

void bootstrap();
