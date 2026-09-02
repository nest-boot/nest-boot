import { Logger } from '@nest-boot/logger';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app/app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: true,
  });

  const logger = await app.resolve(Logger);

  process.on('unhandledRejection', (err, promise) => {
    logger.error('Unhandled rejection exception', { err, promise });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { err });
  });

  app.useLogger(logger);
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, forbidUnknownValues: false }),
  );

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
