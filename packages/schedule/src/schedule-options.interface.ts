export interface ScheduleOptions {
  type: "cron" | "interval";
  value: number | string;
  timezone?: string;
}
