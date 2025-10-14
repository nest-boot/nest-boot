import { type RegisterQueueOptions } from "@nest-boot/bullmq";

export interface ScheduleModuleOptions extends RegisterQueueOptions {
  autorun?: boolean;
  concurrency?: number;
}
