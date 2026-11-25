import { CommandModule } from "@nest-boot/command";
import { QueueModule } from "@nest-boot/queue";
import { ScheduleModule } from "@nest-boot/schedule";
import { Module } from "@nestjs/common";

import { WorkerModule } from "./app/worker/worker.module.js";

@Module({
  imports: [
    CommandModule,
    QueueModule,
    ScheduleModule.forRootAsync({
      useFactory: () => ({
        concurrency: 3,
        prefix: process.env.QUEUE_TEST_PREFIX,
      }),
    }),
    WorkerModule,
  ],
})
export class AppModule {}
