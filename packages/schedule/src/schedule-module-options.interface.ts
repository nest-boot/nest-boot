import { type WorkerOptions } from "bullmq";

export interface ScheduleModuleOptions extends WorkerOptions {
  name?: string;
}
