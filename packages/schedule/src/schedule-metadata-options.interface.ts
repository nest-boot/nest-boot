export interface ScheduleMetadataOptions {
  type: "cron" | "interval";
  value: number | string;
  timezone?: string;
}
