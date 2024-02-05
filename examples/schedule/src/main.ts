import { QueueManager } from '@nest-boot/queue';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(3000);

  app.get(QueueManager).runAll();
}
void bootstrap();
