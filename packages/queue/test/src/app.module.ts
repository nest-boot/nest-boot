import { CommandModule } from "@nest-boot/command";
import { QueueModule } from "@nest-boot/queue";
import { Module } from "@nestjs/common";

import { WorkerModule } from "./app/worker/worker.module.js";

@Module({
  imports: [CommandModule, QueueModule, WorkerModule],
})
export class AppModule {}
