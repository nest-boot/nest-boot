import { repl } from '@nest-boot/request-context';

import { AppModule } from './app/app.module.js';

async function bootstrap() {
  await repl(AppModule);
}

void bootstrap();
