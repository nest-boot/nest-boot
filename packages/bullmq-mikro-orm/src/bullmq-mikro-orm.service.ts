import { type EntityData, EntityManager } from "@mikro-orm/core";
import { WorkerHost } from "@nest-boot/bullmq";
import { Cron } from "@nest-boot/schedule";
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { type InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { type Job, type JobState, Queue } from "bullmq";

import { MODULE_OPTIONS_TOKEN } from "./bullmq-mikro-orm.module-definition.js";
import { type BullMQMikroORMModuleOptions } from "./bullmq-mikro-orm-module-options.interface.js";
import { JobEntity } from "./entities/job.entity.js";
import { convertBullmqJobStateToJobStatus } from "./utils/convert-bullmq-job-state-to-job-status.util.js";
import { shouldIncludeQueue } from "./utils/should-include-queue.util.js";

@Injectable()
export class BullMQMikroORMService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BullMQMikroORMService.name);

  private readonly jobTTL: number = 1000 * 60 * 60 * 24 * 30;

  private readonly includeQueues: string[] = [];
  private readonly excludeQueues: string[] = [];

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: BullMQMikroORMModuleOptions,
  ) {
    this.jobTTL = this.options.jobTTL ?? this.jobTTL;
    this.includeQueues = this.options.includeQueues ?? this.includeQueues;
    this.excludeQueues = this.options.excludeQueues ?? this.excludeQueues;
  }

  async convertJobToEntityData(
    job: Job,
    jobState: JobState,
  ): Promise<EntityData<JobEntity>> {
    let latestJobState = await job.getState();

    if (latestJobState === "unknown") {
      latestJobState = jobState;
    }

    return {
      id: `${job.queueName}:${job.id ?? ""}`,
      queueName: job.queueName,
      name: job.name,
      data: job.data ?? null,
      returnValue: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null,
      priority: job.priority,
      progress: job.progress,
      status: convertBullmqJobStateToJobStatus(latestJobState),
      startedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      createdAt: new Date(job.timestamp),
      updatedAt: new Date(),
      ...(this.options.convertJobToEntityData
        ? await this.options.convertJobToEntityData(job)
        : {}),
    };
  }

  async upsertJob(job: Job, jobState: JobState) {
    await this.em
      .fork()
      .upsert(
        this.options.jobEntity,
        await this.convertJobToEntityData(job, jobState),
        {
          onConflictFields: ["id"],
        },
      );
  }

  /** Records history without turning an observer failure into a worker failure. */
  private recordJobEvent(job: Job, state: JobState): void {
    void this.upsertJob(job, state).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to persist job ${job.queueName}:${job.id ?? "unknown"} (${state}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  @Cron("0 * * * *")
  async cleanHistoryJobs() {
    await this.em.fork().nativeDelete(this.options.jobEntity, {
      updatedAt: {
        $lt: new Date(Date.now() - this.jobTTL),
      },
    });
  }

  onApplicationBootstrap() {
    const instanceWrappers = this.discoveryService.getProviders();

    instanceWrappers
      .filter((provider) => provider.instance instanceof Queue)
      .filter((provider: InstanceWrapper<Queue>) =>
        shouldIncludeQueue(
          provider.instance.name,
          this.includeQueues,
          this.excludeQueues,
        ),
      )
      .forEach((provider: InstanceWrapper<Queue>) => {
        void provider.instance.on("waiting", (job) => {
          this.recordJobEvent(job, "waiting");
        });
      });

    instanceWrappers
      .filter((provider) => provider.instance instanceof WorkerHost)
      .filter((provider: InstanceWrapper<WorkerHost>) =>
        shouldIncludeQueue(
          provider.instance.worker.name,
          this.includeQueues,
          this.excludeQueues,
        ),
      )
      .forEach((provider: InstanceWrapper<WorkerHost>) => {
        provider.instance.worker.on("active", (job) => {
          this.recordJobEvent(job, "active");
        });
        provider.instance.worker.on("progress", (job) => {
          this.recordJobEvent(job, "active");
        });
        provider.instance.worker.on("completed", (job) => {
          this.recordJobEvent(job, "completed");
        });
        provider.instance.worker.on("failed", (job) => {
          if (job) this.recordJobEvent(job, "failed");
        });
      });
  }
}
