import { SetMetadata } from "@nestjs/common";

import { SCHEDULE_METADATA_KEY } from "./schedule.module-definition";
import { type ScheduleOptions } from "./schedule-options.interface";

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

export const Cron = (
  value: string,
  options?: Omit<ScheduleOptions, "type" | "value">,
) =>
  Schedule({
    type: "cron",
    value,
    ...(options ?? {}),
  });

export const Interval = (value: number | string) =>
  Schedule({
    type: "interval",
    value,
  });
