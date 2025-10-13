import {
  CreateRequestContext,
  RequestContext,
} from "@nest-boot/request-context";
import { JOB_REF, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, OnApplicationBootstrap } from "@nestjs/common";
import { Job } from "bullmq";

import { MODULE_OPTIONS_TOKEN } from "./schedule.module-definition";
import { ScheduleRegistry } from "./schedule.registry";
import { ScheduleModuleOptions } from "./schedule-module-options.interface";

@Processor("schedule")
export class ScheduleProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: ScheduleModuleOptions,
    private readonly scheduleRegistry: ScheduleRegistry,
  ) {
    super();
  }

  @CreateRequestContext((_, job: Job) => {
    const ctx = new RequestContext({ type: "schedule", id: job.id });
    ctx.set(JOB_REF, job);
    return ctx;
  })
  async process(job: Job): Promise<void> {
    await this.scheduleRegistry.get(job.name)?.handler();
  }

  onApplicationBootstrap() {
    if (this.options.concurrency) {
      this.worker.concurrency = this.options.concurrency;
    }
  }
}
