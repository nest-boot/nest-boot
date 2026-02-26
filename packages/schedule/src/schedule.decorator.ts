import { SetMetadata } from "@nestjs/common";

import { SCHEDULE_METADATA_KEY } from "./schedule.module-definition";
import { type ScheduleOptions } from "./schedule-options.interface";

/**
 * Decorator to schedule a method execution.
 *
 * @param options - Scheduling options.
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
 * Decorator to schedule a method using a cron expression.
 *
 * @param value - The cron expression.
 * @param options - Additional job options.
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
 * Decorator to schedule a method using a time interval.
 *
 * @param value - The interval in milliseconds.
 * @param options - Additional job options.
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
