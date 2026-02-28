import { SetMetadata } from "@nestjs/common";

import { SCHEDULE_METADATA_KEY } from "./schedule.module-definition";
import { type ScheduleOptions } from "./schedule-options.interface";

/**
 * Decorator that registers a method as a scheduled job.
 * @param options - Schedule configuration (type, value, timezone, etc.)
 * @returns Method decorator
 */
export const Schedule =
  (options: ScheduleOptions) =>
  <T>(
    target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) => {
    SetMetadata<string, ScheduleOptions>(SCHEDULE_METADATA_KEY, options)(
      target,
      propertyKey,
      descriptor,
    );
  };

/**
 * Decorator that registers a method as a cron-scheduled job.
 * @param value - Cron expression (e.g. `"0 * * * *"`)
 * @param options - Additional schedule options (timezone, etc.)
 * @returns Method decorator
 */
export const Cron = (
  value: string,
  options?: Omit<ScheduleOptions, "type" | "value">,
) =>
  Schedule({
    type: "cron",
    value,
    ...(options ?? {}),
  });

/**
 * Decorator that registers a method as an interval-scheduled job.
 * @param value - Interval in milliseconds
 * @param options - Additional schedule options
 * @returns Method decorator
 */
export const Interval = (
  value: number | string,
  options?: Omit<ScheduleOptions, "type" | "value">,
) =>
  Schedule({
    type: "interval",
    value,
    ...(options ?? {}),
  });
