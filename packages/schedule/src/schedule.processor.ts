import { BaseProcessor, Processor } from "@nest-boot/queue";
import { Inject, Optional } from "@nestjs/common";
import { Job } from "bullmq";

import { MODULE_OPTIONS_TOKEN } from "./schedule.module-definition.js";
import { ScheduleQueue } from "./schedule.queue.js";
import { ScheduleRegistry } from "./schedule.registry.js";
import { type ScheduleModuleOptions } from "./schedule-module-options.interface.js";

@Processor(ScheduleQueue)
export class ScheduleProcessor extends BaseProcessor {
  constructor(
    private readonly scheduleRegistry: ScheduleRegistry,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    options?: ScheduleModuleOptions,
  ) {
    super({ concurrency: options?.concurrency ?? 1 });
  }

  async process(job: Job): Promise<void> {
    await this.scheduleRegistry.get(job.name)?.handler();
  }
}
