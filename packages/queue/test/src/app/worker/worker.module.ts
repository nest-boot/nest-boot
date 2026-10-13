import { Module } from "@nestjs/common";

import { EmailsProcessor } from "./emails.processor.js";
import { EmailsQueue } from "./emails.queue.js";
import { ReportsProcessor } from "./reports.processor.js";
import { ReportsQueue } from "./reports.queue.js";
import { TasksService } from "./tasks.service.js";

@Module({
  providers: [
    ReportsQueue,
    EmailsQueue,
    ReportsProcessor,
    EmailsProcessor,
    TasksService,
  ],
  exports: [ReportsQueue, EmailsQueue],
})
export class WorkerModule {}
