import { Processor, WorkerHost } from "@nest-boot/bullmq";
import { Inject, OnApplicationBootstrap, Optional } from "@nestjs/common";
import { Job } from "bullmq";

import { MODULE_OPTIONS_TOKEN } from "./schedule.module-definition";
import { ScheduleRegistry } from "./schedule.registry";
import { ScheduleModuleOptions } from "./schedule-module-options.interface";

@Processor("schedule", { autorun: false })
export class ScheduleProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  constructor(
    private readonly scheduleRegistry: ScheduleRegistry,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options?: ScheduleModuleOptions,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.scheduleRegistry.get(job.name)?.handler();
  }

  async onApplicationBootstrap() {
    if (this.options?.concurrency) {
      this.worker.concurrency = this.options.concurrency;
    }

    if (this.options?.autorun !== false && this.worker.isPaused()) {
      await this.worker.run();
    }
  }
}
