import {
  type EntityData,
  EntityManager,
  type FilterQuery,
} from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import type {
  ConnectionArgsInterface,
  ConnectionResult,
} from "@nest-boot/graphql-connection";
import { WorkerHost } from "@nestjs/bullmq";
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { type InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { type Job, type JobState, Queue, type Worker } from "bullmq";
import type { GraphQLResolveInfo } from "graphql";

import { Job as PersistedJob } from "../entities/job.entity.js";
import { MODULE_OPTIONS_TOKEN } from "../queue.constants.js";
import type { QueueModuleOptions } from "../queue-module-options.interface.js";
import { convertQueueJobStateToJobStatus } from "../utils/convert-queue-job-state-to-job-status.util.js";

/** Persists queue jobs and reads them within the application's authorized scope. */
@Injectable()
export class JobService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobService.name);

  private cleanupTimer?: ReturnType<typeof setInterval>;
  private cleanup?: Promise<void>;
  private readonly unsubscribe: (() => void)[] = [];
  private readonly workers = new Set<Worker>();
  private readonly writes = new Map<string, Promise<void>>();

  private readonly ttl: number;

  private readonly queues = new Set<Queue>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: QueueModuleOptions,
  ) {
    this.ttl = this.options.persistence?.ttl ?? 1000 * 60 * 60 * 24 * 30;
  }

  private async getJobData(
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
    };
  }

  async upsertJob(job: Job, jobState: JobState) {
    await this.em
      .fork()
      .upsert(PersistedJob, await this.getJobData(job, jobState), {
        onConflictFields: ["id"],
      });
  }

  /**
   * Persists job events without turning an observer failure into a worker failure.
   * @param job - Queue job whose context is captured.
   * @param state - Queue job state reported by the event.
   */
  private recordJobEvent(job: Job, state: JobState): void {
    const id = `${job.queueName}:${job.id ?? ""}`;
    const previous = this.writes.get(id);
    // A slow earlier write must not overwrite this job's later result.
    const pending = previous
      ? previous.then(() => this.upsertJob(job, state))
      : this.upsertJob(job, state);
    const write = pending.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to persist job ${job.queueName}:${job.id ?? "unknown"} (${state}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
    this.writes.set(id, write);
    void write.then(() => {
      if (this.writes.get(id) === write) this.writes.delete(id);
    });
  }

  async cleanJobs() {
    await this.em.fork().nativeDelete(PersistedJob, {
      updatedAt: {
        $lt: new Date(Date.now() - this.ttl),
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
        this.cleanup = this.cleanJobs()
          .catch((error: unknown) => {
            this.logger.error("Failed to clean jobs", error);
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
    await Promise.all([...this.writes.values(), this.cleanup]);
  }

  private async getReadFilter(): Promise<FilterQuery<PersistedJob>> {
    const filter = await this.options.getJobReadFilter?.();
    if (filter == null)
      throw new ForbiddenException(
        "Job access is not configured for this identity",
      );
    return filter;
  }

  /**
   * Reads one authorized job, returning null when missing or outside the scope.
   * @param id - Queue name and BullMQ job ID, separated by a colon.
   * @returns The visible job, or null.
   */
  async getJob(id: string): Promise<PersistedJob | null> {
    return await this.em.findOne(PersistedJob, {
      $and: [await this.getReadFilter(), { id }],
    });
  }

  /**
   * Queries persisted jobs, applying the same authorized scope to rows and counts.
   * @param args - Pagination, filtering and sorting arguments.
   * @param info - GraphQL selection information.
   * @returns A connection containing only authorized jobs.
   */
  async getJobConnection(
    args: ConnectionArgsInterface<PersistedJob>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<PersistedJob>> {
    const where = await this.getReadFilter();
    const { ConnectionManager } = await import("@nest-boot/graphql-connection");
    const { JobConnection } =
      await import("../connections/job.connection-definition.js");
    return await new ConnectionManager(this.em as SqlEntityManager).find(
      JobConnection,
      args,
      {
        where,
        ...(info && { info }),
      },
    );
  }
}
