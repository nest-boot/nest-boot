import { JobSchedulerTemplateOptions } from "bullmq";

export interface ScheduleOptions extends JobSchedulerTemplateOptions {
  type: "cron" | "interval";
  value: number | string;
  timezone?: string;
}
