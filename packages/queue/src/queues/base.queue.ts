import type { OnApplicationShutdown } from "@nestjs/common";
import {
  type JobType,
  Queue as BullmqQueue,
  type QueueEvents as BullmqQueueEvents,
  type RepeatOptions,
  UnrecoverableError,
} from "bullmq";
import { ZodObject } from "zod";

import { getQueueName } from "../decorators/queue.decorator.js";
import type {
  Job,
  QueueAddArgs,
  QueueBulkJob,
  QueueSchedulerArgs,
} from "../interfaces/job.interface.js";
import type {
  JobSchema,
  JobSchemas,
} from "../interfaces/job-schemas.interface.js";
import type { QueueOptions } from "../interfaces/queue-options.interface.js";
import { QUEUE_EVENTS_REF } from "../queue.constants.js";
import { assertUniqueProcessMethods } from "../utils/get-process-method-name.util.js";
import { getRedisConfig } from "../utils/get-redis-config.util.js";

/** Redis queue with inferred job contracts, constructor options and managed shutdown. */
export abstract class BaseQueue
  extends BullmqQueue
  implements OnApplicationShutdown
{
  readonly jobSchemas?: JobSchemas;
  /** @internal */
  [QUEUE_EVENTS_REF]?: BullmqQueueEvents;

  /**
   * Creates a named queue; connection defaults to REDIS_URL.
   * @param options - Redis settings and default job options.
   */
  constructor(options: QueueOptions = {}) {
    const name = getQueueName(new.target);
    super(name, {
      ...options,
      connection: options.connection ?? getRedisConfig(),
    });
  }

  /** @returns The event reader after QueueManager initializes; reading starts at application bootstrap. */
  get queueEvents(): BullmqQueueEvents {
    if (!this[QUEUE_EVENTS_REF]) {
      throw new Error(
        "Queue events are not initialized; initialize the application first.",
      );
    }
    return this[QUEUE_EVENTS_REF];
  }

  /**
   * Validates one job before handing its original payload to BullMQ.
   * @param args - Correlated job name, data and BullMQ options.
   * @returns The stored job, with its precise name, input data and result types.
   */
  override async add<A extends QueueAddArgs<this>>(
    ...args: A
  ): Promise<Job<this, A[0]>> {
    const [name, data, opts] = args;
    await this.validateJobData(name, data);
    return (await super.add(name, data, opts)) as Job<this, A[0]>;
  }

  /**
   * Validates the entire batch before submitting any jobs to BullMQ.
   * @param jobs - Named job payloads and options.
   * @returns Stored jobs in input order.
   */
  override async addBulk(jobs: QueueBulkJob<this>[]): Promise<Job<this>[]> {
    await Promise.all(
      jobs.map(async (job) => {
        await this.validateJobData(job.name, job.data);
      }),
    );
    return (await super.addBulk([...jobs])) as Job<this>[];
  }

  /**
   * Validates the template before creating or updating a BullMQ scheduler.
   * @param jobSchedulerId - Scheduler identifier, independent of the job name.
   * @param repeatOpts - Scheduling interval or pattern.
   * @param args - Typed job template; optional for queues without schemas.
   * @returns The first scheduled job.
   */
  override async upsertJobScheduler(
    jobSchedulerId: string,
    repeatOpts: Omit<RepeatOptions, "key">,
    ...args: QueueSchedulerArgs<this>
  ): Promise<Job<this>> {
    const [template] = args;
    await this.validateJobData(
      template?.name ?? jobSchedulerId,
      template?.data ?? {},
    );
    return (await super.upsertJobScheduler(
      jobSchedulerId,
      repeatOpts,
      template,
    )) as Job<this>;
  }

  /**
   * Reads a job with the queue's stored payload and result types.
   * @param jobId - BullMQ job ID.
   * @returns Stored job, if it still exists.
   */
  override async getJob(jobId: string): Promise<Job<this> | undefined> {
    return (await super.getJob(jobId)) as Job<this> | undefined;
  }

  /**
   * Reads a range of stored jobs as a discriminated union.
   * @param types - BullMQ states to read.
   * @param start - First index.
   * @param end - Last index.
   * @param asc - Whether to read in ascending order.
   * @returns Matching stored jobs.
   */
  override async getJobs(
    types?: JobType[] | JobType,
    start?: number,
    end?: number,
    asc?: boolean,
  ): Promise<Job<this>[]> {
    return (await super.getJobs(types, start, end, asc)) as Job<this>[];
  }

  private getJobSchema(name: string): JobSchema | undefined {
    if (!this.jobSchemas) {
      return undefined;
    }
    assertUniqueProcessMethods(Object.keys(this.jobSchemas));
    if (!Object.hasOwn(this.jobSchemas, name)) {
      throw new UnrecoverableError(
        `Unknown job "${name}" in queue "${this.name}".`,
      );
    }
    const schema = this.jobSchemas[name];
    if (!(schema.data instanceof ZodObject)) {
      throw new TypeError(`Job "${name}" data schema must be z.object().`);
    }
    return schema;
  }

  /**
   * Validates input without replacing it with the parsed result.
   * @param name - Job name.
   * @param data - Original stored payload.
   * @internal
   */
  async validateJobData(name: string, data: unknown): Promise<void> {
    const schema = this.getJobSchema(name);
    if (schema) {
      await schema.data.parseAsync(data);
    }
  }

  /**
   * Validates a Processor result before BullMQ completes the job.
   * @param name - Job name.
   * @param result - Handler return value.
   * @internal
   */
  async validateJobResult(name: string, result: unknown): Promise<void> {
    const schema = this.getJobSchema(name);
    if (!schema) {
      return;
    }
    if (schema.result) {
      await schema.result.parseAsync(result);
      return;
    }
    if (result !== undefined) {
      throw new TypeError(`Job "${name}" does not declare a result schema.`);
    }
  }

  /** Rejects ambiguous schemas before the application starts consuming jobs. */
  onModuleInit(): void {
    if (this.jobSchemas) {
      assertUniqueProcessMethods(Object.keys(this.jobSchemas));
    }
  }

  /** Closes the Redis connection during application shutdown. */
  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }

  /** Closes the event reader and queue connection. */
  override async close(): Promise<void> {
    try {
      await this[QUEUE_EVENTS_REF]?.close();
    } finally {
      this[QUEUE_EVENTS_REF] = undefined;
      await super.close();
    }
  }
}
