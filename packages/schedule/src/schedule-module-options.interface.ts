import { WorkerOptions } from "bullmq";

export interface ScheduleModuleOptions extends WorkerOptions {
  name?: string;
}
