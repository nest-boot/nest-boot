import { isCommandContext } from "@nest-boot/command";
import { BaseProcessor, Processor } from "@nest-boot/queue";
import {
  Inject,
  Logger,
  OnApplicationBootstrap,
  Optional,
} from "@nestjs/common";
import { Job } from "bullmq";

import { MODULE_OPTIONS_TOKEN } from "./schedule.module-definition.js";
import { ScheduleQueue } from "./schedule.queue.js";
import { ScheduleRegistry } from "./schedule.registry.js";
import { type ScheduleModuleOptions } from "./schedule-module-options.interface.js";

@Processor(ScheduleQueue, { autorun: false })
export class ScheduleProcessor
  extends BaseProcessor
  implements OnApplicationBootstrap
{
  /**
   * Logger for worker lifecycle failures.
   * @internal
   */
  private readonly logger = new Logger(ScheduleProcessor.name);

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

  onApplicationBootstrap() {
    if (isCommandContext()) return;
    if (this.options?.concurrency) {
      this.worker.concurrency = this.options.concurrency;
    }

    if (this.options?.autorun !== false) {
      void this.worker.run().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Schedule worker stopped unexpectedly: ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    }
  }
}
