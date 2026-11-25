import { CommandModule } from "@nest-boot/command";
import { QueueModule } from "@nest-boot/queue";
import { ScheduleModule } from "@nest-boot/schedule";
import { Module } from "@nestjs/common";

import { OtherProcessor } from "./other.processor.js";
import { OtherQueue } from "./other.queue.js";
import { PingCommand } from "./ping.command.js";
import { TasksService } from "./tasks.service.js";

@Module({
  imports: [
    CommandModule,
    QueueModule,
    ScheduleModule.forRootAsync({
      useFactory: () => ({
        concurrency: 3,
        prefix: process.env.SCHEDULE_TEST_PREFIX,
      }),
    }),
  ],
  providers: [OtherQueue, OtherProcessor, PingCommand, TasksService],
})
export class AppModule {}
