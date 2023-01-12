import { SetMetadata } from "@nestjs/common";

import { SCHEDULE_METADATA_KEY } from "./schedule.module-definition";
import { ScheduleMetadataOptions } from "./schedule-metadata-options.interface";

export const Schedule =
  (options: ScheduleMetadataOptions): MethodDecorator =>
  <T>(
    target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ) =>
    SetMetadata<string, ScheduleMetadataOptions>(
      SCHEDULE_METADATA_KEY,
      options
    )(target, propertyKey, descriptor);

export const Cron = (value: string): MethodDecorator =>
  Schedule({
    type: "cron",
    value,
  });

export const Interval = (value: number | string): MethodDecorator =>
  Schedule({
    type: "interval",
    value,
  });
