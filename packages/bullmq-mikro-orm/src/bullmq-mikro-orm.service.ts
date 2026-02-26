import { EntityData, EntityManager } from "@mikro-orm/core";
import { WorkerHost } from "@nest-boot/bullmq";
import { Cron } from "@nest-boot/schedule";
import { Inject, Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { Job, JobState, Queue } from "bullmq";

import { MODULE_OPTIONS_TOKEN } from "./bullmq-mikro-orm.module-definition";
import { BullMQMikroORMModuleOptions } from "./bullmq-mikro-orm-module-options.interface";
import { JobEntity } from "./entities/job.entity";
import { convertBullmqJobStateToJobStatus } from "./utils/convert-bullmq-job-state-to-job-status.util";
import { shouldIncludeQueue } from "./utils/should-include-queue.util";

/**
 * Service that listens to BullMQ events and persists job data to the database.
 */
@Injectable()
export class BullMQMikroORMService implements OnApplicationBootstrap {
  private readonly jobTTL: number = 1000 * 60 * 60 * 24 * 30; // 30 days

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

  /**
   * Converts a BullMQ Job instance to an entity data object.
   *
   * @param job - The BullMQ job.
   * @param jobState - The current state of the job.
   * @returns Entity data for JobEntity.
   */
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

  /**
   * Upserts a job record in the database.
   *
   * @param job - The BullMQ job.
   * @param jobState - The current state of the job.
   */
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

  /**
   * Cron job to clean up old job records from the database.
   * Runs hourly.
   */
  @Cron("0 * * * *")
  async cleanHistoryJobs() {
    await this.em.fork().nativeDelete(this.options.jobEntity, {
      updatedAt: {
        $lt: new Date(Date.now() - this.jobTTL),
      },
    });
  }

  /**
   * Lifecycle hook to register event listeners on queues and workers.
   */
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
        void provider.instance.on(
          "waiting",
          (job) => void this.upsertJob(job, "waiting"),
        );
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
        provider.instance.worker.on(
          "active",
          (job) => void this.upsertJob(job, "active"),
        );
        provider.instance.worker.on(
          "progress",
          (job) => void this.upsertJob(job, "active"),
        );
        provider.instance.worker.on(
          "completed",
          (job) => void this.upsertJob(job, "completed"),
        );
        provider.instance.worker.on(
          "failed",
          (job) => job && void this.upsertJob(job, "failed"),
        );
      });
  }
}
