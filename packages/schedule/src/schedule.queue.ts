import {
  BaseQueue,
  Queue,
  QUEUE_MODULE_OPTIONS,
  type QueueModuleOptions,
} from "@nest-boot/queue";
import { Inject } from "@nestjs/common";

import {
  MODULE_OPTIONS_TOKEN,
  SCHEDULE_QUEUE_NAME,
} from "./schedule.module-definition.js";
import type { ScheduleModuleOptions } from "./schedule-module-options.interface.js";

/** Internal queue shared by the scheduler and its consumer. */
@Queue({ name: SCHEDULE_QUEUE_NAME })
export class ScheduleQueue extends BaseQueue {
  constructor(
    @Inject(QUEUE_MODULE_OPTIONS) moduleOptions: QueueModuleOptions,
    @Inject(MODULE_OPTIONS_TOKEN) options: ScheduleModuleOptions,
  ) {
    const queueOptions = { ...options };
    delete queueOptions.autorun;
    delete queueOptions.concurrency;
    super(moduleOptions, queueOptions);
  }
}
