import { JobSchedulerTemplateOptions } from "bullmq";

/** Options for configuring a scheduled job. */
export interface ScheduleOptions extends JobSchedulerTemplateOptions {
  /** Type of schedule: `"cron"` for cron expressions or `"interval"` for millisecond intervals. */
  type: "cron" | "interval";
  /** Cron expression (for `"cron"` type) or millisecond interval (for `"interval"` type). */
  value: number | string;
  /** Timezone for cron expressions (defaults to `"UTC"`). */
  timezone?: string;
}
