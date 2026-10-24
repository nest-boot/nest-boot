import { BaseQueue, Queue } from "@nest-boot/queue";
import { Inject } from "@nestjs/common";
import { z } from "zod";

import {
  MODULE_OPTIONS_TOKEN,
  SCHEDULE_QUEUE_NAME,
} from "./schedule.module-definition.js";
import type { ScheduleModuleOptions } from "./schedule-module-options.interface.js";

/** Internal queue shared by the scheduler and its consumer. */
@Queue(SCHEDULE_QUEUE_NAME)
export class ScheduleQueue extends BaseQueue {
  readonly jobSchemas = {
    run: { data: z.object({ name: z.string().min(1) }) },
  };

  constructor(@Inject(MODULE_OPTIONS_TOKEN) options: ScheduleModuleOptions) {
    const queueOptions = { ...options };
    delete queueOptions.concurrency;
    super(queueOptions);
  }
}
