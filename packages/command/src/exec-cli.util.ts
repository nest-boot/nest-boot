import { RUNTIME_KEY } from "@nest-boot/common";
import { Logger, logger } from "@nest-boot/logger";
import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { CommandModule } from "./command.module";
import { CommandService } from "./command.service";

const { COMMAND_DEBUG } = process.env;

export async function execCli(
  module: unknown,
  callback?: (app: INestApplicationContext) => void | Promise<void>
): Promise<void> {
  process[RUNTIME_KEY] = "cli";

  const app = await NestFactory.createApplicationContext(module);

  // 获取日志服务
  const loggerService = app.get(Logger);

  // 使用日志服务
  app.useLogger(loggerService);

  if (callback) {
    await callback(app);
  }

  app.select(CommandModule).get(CommandService).exec();
}
