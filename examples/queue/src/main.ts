import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { QueueManager } from '@nest-boot/queue';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(3000);

  app.get(QueueManager).runAll();
}
void bootstrap();
