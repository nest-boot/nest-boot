import { CommandModule } from "@nest-boot/command";
import { QueueModule } from "@nest-boot/queue";
import { Module } from "@nestjs/common";

import { ScheduleModule } from "../../../schedule/dist/index.js";
import { WorkerModule } from "./app/worker/worker.module.js";

@Module({
  imports: [
    CommandModule,
    QueueModule.forRootAsync({
      useFactory: () => ({
        connection: {
          connectionString: process.env.QUEUE_DATABASE_URL,
          schema: process.env.QUEUE_TEST_SCHEMA,
        },
        graphql: false,
      }),
    }),
    ScheduleModule.forRootAsync({
      useFactory: () => ({
        autorun: process.env.QUEUE_TEST_SCHEDULE_AUTORUN !== "false",
      }),
    }),
    WorkerModule,
  ],
})
export class AppModule {}
