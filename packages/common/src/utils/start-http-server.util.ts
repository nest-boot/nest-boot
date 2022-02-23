import { Logger } from "@nest-boot/logger";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";

import { RUNTIME_KEY } from "../constants";
import { GlobalExceptionFilter } from "../exception-filters/global.exception-filter";

export async function startHttpServer(
  module: unknown,
  callback?: (app: INestApplication) => void | Promise<void>
): Promise<void> {
  process[RUNTIME_KEY] = "http-server";

  // 创建服务器实例
  const app = await NestFactory.create(module, { bufferLogs: true });

  // 启用关机钩子
  app.enableShutdownHooks();

  // 获取日志服务
  const loggerService = app.get(Logger);

  // 使用日志服务
  app.useLogger(loggerService);

  // 使用扩展异常过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 使用验证管道
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // 获取配置服务
  const configService = app.get(ConfigService);

  // Cookie 解析
  app.use(cookieParser());

  if (callback) {
    await callback(app);
  }

  // 监听端口
  await app.listen(+(configService.get("PORT") || 80));
}
