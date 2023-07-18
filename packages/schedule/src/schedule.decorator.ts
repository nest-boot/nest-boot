import { Processor } from "@nest-boot/queue";
import { SetMetadata } from "@nestjs/common";

import { getScheduleProcessorName } from "./get-schedule-processor-name.util";
import { SCHEDULE_METADATA_KEY } from "./schedule.module-definition";
import { type ScheduleMetadataOptions } from "./schedule-metadata-options.interface";

export const Schedule =
  (options: ScheduleMetadataOptions) =>
  <T>(
    // eslint-disable-next-line @typescript-eslint/ban-types
    target: Object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) => {
    Processor(getScheduleProcessorName(target, propertyKey))(
      target,
      propertyKey,
      descriptor,
    );
    SetMetadata<string, ScheduleMetadataOptions>(
      SCHEDULE_METADATA_KEY,
      options,
    )(target, propertyKey, descriptor);
  };

export const Cron = (
  value: string,
  options?: Omit<ScheduleMetadataOptions, "type" | "value">,
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
