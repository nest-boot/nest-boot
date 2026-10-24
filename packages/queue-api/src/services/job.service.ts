import { EntityManager, type FilterQuery, raw } from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import { API_KEY, User, UserService, WorkspaceService } from "@nest-boot/auth";
import {
  type ConnectionArgsInterface,
  ConnectionManager,
  type ConnectionResult,
  OrderDirection,
} from "@nest-boot/graphql-connection";
import { BaseQueue, type Job, QueueManager } from "@nest-boot/queue";
import { RequestContext } from "@nest-boot/request-context";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Job as BullmqJob, type JobProgress, type JobState } from "bullmq";
import type { GraphQLResolveInfo } from "graphql";

import { JobConnection } from "../connections/job.connection-definition.js";
import { isQueueVisible } from "../decorators/queue-visible.decorator.js";
import { Job as JobEntity } from "../entities/job.entity.js";
import { JobStatus } from "../enums/job-status.enum.js";
import { JobQueue } from "../queues/job.queue.js";

const jobStatuses = new Map<string, JobStatus>(
  Object.values(JobStatus).map((status) => [status, status]),
);

/** Manages Job history queries and forwards Redis events to the persistence queue. */
@Injectable()
export class JobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobService.name);
  private readonly sources: BaseQueue[] = [];
  private readonly pending = new Set<Promise<void>>();
  private shutdown?: Promise<void>;

  constructor(
    private readonly em: EntityManager,
    private readonly queue: JobQueue,
    private readonly manager: QueueManager,
    private readonly users: UserService,
    private readonly workspaces: WorkspaceService,
  ) {
    this.queue.on("error", (error) => {
      this.logger.error(error);
    });
  }

  /**
   * Reads one task belonging to the current user.
   * @param id - Database-generated Job UUID.
   * @returns Matching record in the authorized scope, or null.
   */
  async getUserJob(id: string): Promise<JobEntity | null> {
    return await this.getScopedJob(id, this.userFilter());
  }

  /**
   * Paginates tasks belonging to the current user.
   * @param args - Cursor pagination, filters and creation-time ordering.
   * @param info - GraphQL selection used to shape the query.
   * @returns Nodes and counts within the same authorized scope.
   */
  async getUserJobConnection(
    args: ConnectionArgsInterface<JobEntity>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<JobEntity>> {
    return await this.getScopedJobConnection(this.userFilter(), args, info);
  }

  /**
   * Reads one task in the authenticated, selected workspace.
   * @param id - Database-generated Job UUID.
   * @returns Matching record in the authorized scope, or null.
   */
  async getWorkspaceJob(id: string): Promise<JobEntity | null> {
    return await this.getScopedJob(id, this.workspaceFilter());
  }

  /**
   * Paginates tasks in the authenticated, selected workspace.
   * @param args - Cursor pagination, filters and creation-time ordering.
   * @param info - GraphQL selection used to shape the query.
   * @returns Nodes and counts within the same authorized scope.
   */
  async getWorkspaceJobConnection(
    args: ConnectionArgsInterface<JobEntity>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<JobEntity>> {
    return await this.getScopedJobConnection(
      this.workspaceFilter(),
      args,
      info,
    );
  }

  /**
   * Reads an unowned task after checking the current administrator session.
   * @param id - Database-generated Job UUID.
   * @returns Matching record in the authorized scope, or null.
   */
  async getSystemJob(id: string): Promise<JobEntity | null> {
    return await this.getScopedJob(id, this.systemFilter());
  }

  /**
   * Paginates unowned tasks after checking the current administrator session.
   * @param args - Cursor pagination, filters and creation-time ordering.
   * @param info - GraphQL selection used to shape the query.
   * @returns Nodes and counts within the same authorized scope.
   */
  async getSystemJobConnection(
    args: ConnectionArgsInterface<JobEntity>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<JobEntity>> {
    return await this.getScopedJobConnection(this.systemFilter(), args, info);
  }

  private currentUser(): User {
    const user = RequestContext.isActive()
      ? RequestContext.get(User)
      : undefined;
    if (!user?.id) {
      throw new ForbiddenException("An authenticated user is required.");
    }
    return user;
  }

  private userFilter(): FilterQuery<JobEntity> {
    return {
      [raw((alias) => `${alias}."data"->>'userId'`)]: this.currentUser().id,
    };
  }

  private workspaceFilter(): FilterQuery<JobEntity> {
    const workspace = this.workspaces.getCurrentWorkspace();
    if (!workspace?.id) {
      throw new ForbiddenException(
        "An authorized current workspace is required.",
      );
    }
    return {
      [raw((alias) => `${alias}."data"->>'workspaceId'`)]: workspace.id,
    };
  }

  private systemFilter(): FilterQuery<JobEntity> {
    const user = this.currentUser();
    // API credentials must not inherit their owner's administrator role.
    if (RequestContext.get(API_KEY) || !this.users.isAdmin(user)) {
      throw new ForbiddenException("An administrator session is required.");
    }
    return {
      [raw((alias) => `${alias}."data"->>'userId'`)]: null,
      [raw((alias) => `${alias}."data"->>'workspaceId'`)]: null,
    };
  }

  private async getScopedJob(
    id: string,
    where: FilterQuery<JobEntity>,
  ): Promise<JobEntity | null> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return null;
    }
    return await this.em.findOne(
      JobEntity,
      { $and: [{ id }, this.visibleFilter(where)] },
      { refresh: true },
    );
  }

  private async getScopedJobConnection(
    where: FilterQuery<JobEntity>,
    args: ConnectionArgsInterface<JobEntity>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<JobEntity>> {
    if (args.orderBy && args.orderBy.field !== "createdAt") {
      throw new BadRequestException("Jobs can only be ordered by CREATED_AT.");
    }
    return await new ConnectionManager(this.em as SqlEntityManager).find(
      JobConnection,
      {
        ...args,
        orderBy: args.orderBy ?? {
          field: "createdAt",
          direction: OrderDirection.DESC,
        },
      },
      {
        where: this.visibleFilter(where),
        refresh: true,
        ...(info && { info }),
      },
    );
  }

  private visibleFilter(where: FilterQuery<JobEntity>): FilterQuery<JobEntity> {
    const names = this.manager
      .getQueues()
      .filter(isQueueVisible)
      .map((queue) => queue.name);
    return { $and: [where, { queue: { $in: names } }] };
  }

  /** Attaches history forwarding before QueueManager starts its event readers. */
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      "cleanup",
      { pattern: "0 0 * * *", tz: "UTC" },
      { name: "cleanup", data: {} },
    );
    for (const source of this.manager.getQueues()) {
      if (source instanceof JobQueue) {
        continue;
      }
      const events = source.queueEvents;
      this.sources.push(source);
      for (const state of [
        "waiting",
        "active",
        "delayed",
        "waiting-children",
        "completed",
        "failed",
        "progress",
      ] as const) {
        events.on(
          state,
          (
            args: {
              jobId: string;
              data?: JobProgress;
              returnvalue?: unknown;
              failedReason?: string;
            },
            id: string,
          ) => {
            const pending = this.forward(source, state, args, id)
              .catch((error: unknown) => {
                this.logger.error(error);
              })
              .finally(() => this.pending.delete(pending));
            this.pending.add(pending);
          },
        );
      }
    }
  }

  private async forward(
    source: BaseQueue,
    state: JobState | "progress",
    args: {
      jobId: string;
      data?: JobProgress;
      returnvalue?: unknown;
      failedReason?: string;
    },
    eventId: string,
  ): Promise<void> {
    const job = await BullmqJob.fromId(source, args.jobId);
    const stateValue =
      state === "progress"
        ? await job?.getState()
        : state === "waiting" && job?.priority
          ? "prioritized"
          : state;
    const status = jobStatuses.get(stateValue ?? "");
    const data: Job<JobQueue, "sync">["data"]["data"] = {
      ...(job
        ? {
            name: job.name,
            data: job.data ?? {},
            progress: job.progress,
            returnValue: job.returnvalue ?? null,
            failedReason: job.failedReason ?? null,
            createdAt: job.timestamp,
            startedAt: job.processedOn ?? null,
            finishedAt: job.finishedOn ?? null,
          }
        : {}),
      queue: source.name,
      jobId: args.jobId,
      ...(status && status !== JobStatus.UNKNOWN ? { status } : {}),
    };
    if (state === "completed") {
      data.returnValue = args.returnvalue ?? null;
      data.finishedAt = Number(eventId.split("-")[0]);
    }
    if (state === "failed") {
      data.failedReason = args.failedReason;
      data.finishedAt = Number(eventId.split("-")[0]);
    }
    if (state === "progress") {
      data.progress = args.data;
    }
    await this.queue.add(
      "sync",
      { eventId, data },
      {
        deduplication: {
          id: JSON.stringify([source.qualifiedName, eventId]),
          ttl: 24 * 60 * 60 * 1000,
        },
      },
    );
  }

  private async closeReaders(): Promise<void> {
    const results = await Promise.allSettled(
      this.sources.map(async (source) => {
        await source.queueEvents.close();
      }),
    );
    await Promise.all(this.pending);
    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
      throw failed.reason;
    }
  }

  /**
   * Drains source Workers, event forwarding, then the persistence Worker.
   * @returns Shared completion of synchronization shutdown.
   */
  onModuleDestroy(): Promise<void> {
    return (this.shutdown ??= this.close());
  }

  private async close(): Promise<void> {
    const failures: unknown[] = [];
    for (const close of [
      () => this.manager.stop(this.sources.map((source) => source.name)),
      () => this.closeReaders(),
      () => this.manager.stop([this.queue.name]),
    ]) {
      try {
        await close();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) {
      throw new AggregateError(
        failures,
        "Failed to close Job synchronization.",
      );
    }
  }
}
