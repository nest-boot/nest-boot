import { NestApplicationContextOptions } from "@nestjs/common/interfaces/nest-application-context-options.interface";
import { NestFactory } from "@nestjs/core";

import { QueueServer } from "./interfaces/queue-server.interface";
import { QueueManager } from "./queue.manager";

export async function createQueueServer(
  module: any,
  options?: NestApplicationContextOptions
): Promise<QueueServer> {
  const app = (await NestFactory.createApplicationContext(
    module,
    options
  )) as QueueServer;

  app.start = async () => {
    await app.get(QueueManager).start();
  };

  return app;
}
