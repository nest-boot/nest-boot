import { JobSchedulerTemplateOptions } from "bullmq";

/**
 * Options for scheduling a job.
 */
export interface ScheduleOptions extends JobSchedulerTemplateOptions {
  /**
   * Type of schedule: 'cron' or 'interval'.
   */
  type: "cron" | "interval";

  /**
   * The cron expression or interval duration (in milliseconds).
   */
  value: number | string;

  /**
   * Timezone for cron schedules.
   */
  timezone?: string;
}
