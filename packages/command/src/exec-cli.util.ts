import { Logger, RUNTIME_KEY } from "@nest-boot/common";
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

  const app = await NestFactory.createApplicationContext(module, {
    bufferLogs: true,
  });

  // 启用关机钩子
  app.enableShutdownHooks();

  // 使用日志服务
  app.useLogger(new Logger());

  if (callback) {
    await callback(app);
  }

  app.select(CommandModule).get(CommandService).exec();
}
