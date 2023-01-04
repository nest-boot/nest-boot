import { QueueOptions } from "bullmq";

export interface ScheduleModuleOptions extends QueueOptions {
  name?: string;
}
