import { repl } from '@nest-boot/request-context';

import { AppModule } from './app/app.module.js';

/**
 * Starts an interactive Nest REPL for the example application.
 */
async function bootstrap() {
  await repl(AppModule);
}

void bootstrap();
