import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { Logger } from "../services/logger.service";

export async function startWorker(
  module: unknown,
  callback?: (app: INestApplicationContext) => void | Promise<void>
): Promise<void> {
  const app = await NestFactory.createApplicationContext(module, {
    bufferLogs: true,
  });

  // 启用关机钩子
  app.enableShutdownHooks();

  // 使用日志服务
  app.useLogger(new Logger());

  if (callback != null) {
    await callback(app);
  }
}
