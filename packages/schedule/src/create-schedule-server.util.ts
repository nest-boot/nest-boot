import { NestApplicationContextOptions } from "@nestjs/common/interfaces/nest-application-context-options.interface";
import { NestFactory } from "@nestjs/core";

import { ScheduleService } from "./schedule.service";
import { ScheduleServer } from "./schedule-server.interface";

export async function createScheduleServer(
  module: any,
  options?: NestApplicationContextOptions
): Promise<ScheduleServer> {
  const app = (await NestFactory.createApplicationContext(
    module,
    options
  )) as ScheduleServer;

  app.run = async () => {
    await app.get(ScheduleService).run();
  };

  return app;
}
