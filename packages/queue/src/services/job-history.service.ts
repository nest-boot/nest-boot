import { type EntityData, EntityManager } from "@mikro-orm/core";
import { WorkerHost } from "@nestjs/bullmq";
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { type InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { type Job, type JobState, Queue, type Worker } from "bullmq";

import { Job as PersistedJob } from "../entities/job.entity.js";
import { type JobHistoryOptions } from "../job-history-options.interface.js";
import { JOB_HISTORY_OPTIONS } from "../queue.constants.js";
import { convertQueueJobStateToJobStatus } from "../utils/convert-queue-job-state-to-job-status.util.js";

@Injectable()
export class JobHistoryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(JobHistoryService.name);

  private cleanupTimer?: ReturnType<typeof setInterval>;
  private cleanup?: Promise<void>;
  private readonly unsubscribe: (() => void)[] = [];
  private readonly workers = new Set<Worker>();
  private readonly writes = new Set<Promise<void>>();

  private readonly jobTTL: number = 1000 * 60 * 60 * 24 * 30;

  private readonly queues = new Set<Queue>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly em: EntityManager,
    @Inject(JOB_HISTORY_OPTIONS)
    private readonly options: JobHistoryOptions,
  ) {
    this.jobTTL = this.options.jobTTL ?? this.jobTTL;
  }

  async convertJobToEntityData(
    job: Job,
    jobState: JobState,
  ): Promise<EntityData<PersistedJob>> {
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
      status: convertQueueJobStateToJobStatus(latestJobState),
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
      .upsert(PersistedJob, await this.convertJobToEntityData(job, jobState), {
        onConflictFields: ["id"],
      });
  }

  /**
   * Records history without turning an observer failure into a worker failure.
   * @param job - Queue job whose context is captured.
   * @param state - Queue job state reported by the event.
   */
  private recordJobEvent(job: Job, state: JobState): void {
    const write = this.upsertJob(job, state).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to persist job ${job.queueName}:${job.id ?? "unknown"} (${state}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
    this.writes.add(write);
    void write.finally(() => this.writes.delete(write));
  }

  async cleanHistoryJobs() {
    await this.em.fork().nativeDelete(PersistedJob, {
      updatedAt: {
        $lt: new Date(Date.now() - this.jobTTL),
      },
    });
  }

  /**
   * Includes an explicitly persisted queue in local event observation.
   * @param queue - Queue registered with persist enabled.
   */
  registerQueue(queue: Queue): void {
    this.queues.add(queue);
  }

  onApplicationBootstrap() {
    this.cleanupTimer = setInterval(
      () => {
        if (this.cleanup) return;
        this.cleanup = this.cleanHistoryJobs()
          .catch((error: unknown) => {
            this.logger.error("Failed to clean job history", error);
          })
          .finally(() => {
            this.cleanup = undefined;
          });
      },
      60 * 60 * 1000,
    );
    this.cleanupTimer.unref();

    if (this.queues.size === 0) return;
    const instanceWrappers = this.discoveryService.getProviders();

    for (const queue of this.queues) {
      const onWaiting = (job: Job) => {
        this.recordJobEvent(job, "waiting");
      };
      queue.on("waiting", onWaiting);
      this.unsubscribe.push(() => queue.off("waiting", onWaiting));
    }
    const persistedQueues = new Set(
      [...this.queues].map((queue) => queue.qualifiedName),
    );

    instanceWrappers
      .filter((provider) => provider.instance instanceof WorkerHost)
      .filter((provider: InstanceWrapper<WorkerHost>) =>
        persistedQueues.has(provider.instance.worker.qualifiedName),
      )
      .forEach((provider: InstanceWrapper<WorkerHost>) => {
        const worker = provider.instance.worker;
        this.workers.add(worker);
        for (const [event, state] of [
          ["active", "active"],
          ["progress", "active"],
          ["completed", "completed"],
          ["failed", "failed"],
        ] as const) {
          const listener = (job?: Job) => {
            if (job) this.recordJobEvent(job, state);
          };
          worker.on(event, listener);
          this.unsubscribe.push(() => worker.off(event, listener));
        }
      });
  }

  /** Drains workers before removing observers, then finishes writes before the database closes. */
  async onModuleDestroy(): Promise<void> {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    // BullMQ normally closes workers during onApplicationShutdown, after ORM
    // teardown can begin. Close them here while the database and observers exist.
    await Promise.all([...this.workers].map((worker) => worker.close()));
    for (const unsubscribe of this.unsubscribe.splice(0)) unsubscribe();
    await Promise.all([...this.writes, this.cleanup]);
  }
}
