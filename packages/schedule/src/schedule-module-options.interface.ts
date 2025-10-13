import { type RegisterQueueOptions } from "@nestjs/bullmq";

export interface ScheduleModuleOptions extends RegisterQueueOptions {
  concurrency?: number;
}
