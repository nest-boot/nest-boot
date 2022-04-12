import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { RUNTIME_KEY } from "../constants";
import { Logger } from "../services/logger.service";

export async function startWorker(
  module: unknown,
  callback?: (app: INestApplicationContext) => void | Promise<void>
): Promise<void> {
  process[RUNTIME_KEY] = "worker";

  const app = await NestFactory.createApplicationContext(module, {
    bufferLogs: true,
  });

  // 启用关机钩子
  app.enableShutdownHooks();

  // 获取日志服务
  const loggerService = app.get(Logger);

  // 使用日志服务
  app.useLogger(loggerService);

  if (callback) {
    await callback(app);
  }
}
