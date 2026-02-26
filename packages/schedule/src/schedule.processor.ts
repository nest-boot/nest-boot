import { Processor, WorkerHost } from "@nest-boot/bullmq";
import { Inject, OnApplicationBootstrap, Optional } from "@nestjs/common";
import { Job } from "bullmq";

import { MODULE_OPTIONS_TOKEN } from "./schedule.module-definition";
import { ScheduleRegistry } from "./schedule.registry";
import { ScheduleModuleOptions } from "./schedule-module-options.interface";

/**
 * Processor for the schedule queue.
 * Executes the scheduled method associated with the job.
 */
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

  /**
   * Processes the job by invoking the corresponding scheduled handler.
   *
   * @param job - The BullMQ job containing the schedule name.
   */
  async process(job: Job): Promise<void> {
    await this.scheduleRegistry.get(job.name)?.handler();
  }

  /**
   * Starts the worker if autorun is not set to false.
   */
  onApplicationBootstrap() {
    if (this.options?.concurrency) {
      this.worker.concurrency = this.options.concurrency;
    }

    if (this.options?.autorun !== false) {
      this.worker.run().catch(() => {
        //
      });
    }
  }
}
