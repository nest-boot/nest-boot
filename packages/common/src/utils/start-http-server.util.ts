import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import express from "express";

import { GlobalExceptionFilter } from "../exception-filters/global.exception-filter";
import { Logger } from "../services/logger.service";

export async function startHttpServer(
  module: unknown,
  callback?: (app: INestApplication) => void | Promise<void>
): Promise<void> {
  // 创建服务器实例
  const app = await NestFactory.create(module, {
    bufferLogs: true,
    bodyParser: false,
  });

  // 启用关机钩子
  app.enableShutdownHooks();

  // bodyParser
  app.use(express.json());

  // 使用日志服务
  app.useLogger(new Logger());

  // 使用扩展异常过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 使用验证管道
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // 获取配置服务
  const configService = app.get(ConfigService);

  // Cookie 解析
  app.use(cookieParser());

  if (callback != null) {
    await callback(app);
  }

  // 监听端口
  await app.listen(+(configService.get("PORT") || 80));
}
