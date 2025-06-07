import { EntityClass } from "@mikro-orm/core";
import {
  MetricsTime,
  Processor,
  Queue as BullQueue,
  RepeatableJob,
  Worker as BullWorker,
} from "bullmq";
import { randomUUID } from "crypto";
import { EventEmitter } from "stream";

import { Job as JobEntity } from "./entities/job.entity";
import { JobStatus } from "./enums/job-status.enum";
import {
  BulkJobOptions,
  Job,
  JobOptions,
  QueueModuleOptions,
} from "./interfaces";

type ExtractDataType<DataTypeOrJob, Default> =
  DataTypeOrJob extends Job<infer D, any, any> ? D : Default;
type ExtractResultType<DataTypeOrJob, Default> =
  DataTypeOrJob extends Job<any, infer R, any> ? R : Default;
type ExtractNameType<DataTypeOrJob, Default extends string> =
  DataTypeOrJob extends Job<any, any, infer N> ? N : Default;

export class Queue<
  DataTypeOrJob = any,
  DefaultResultType = any,
  DefaultNameType extends string = string,
  DataType = ExtractDataType<DataTypeOrJob, DataTypeOrJob>,
  ResultType = ExtractResultType<DataTypeOrJob, DefaultResultType>,
  NameType extends string = ExtractNameType<DataTypeOrJob, DefaultNameType>,
> {
  private readonly bullQueue: BullQueue<
    DataTypeOrJob,
    DefaultResultType,
    DefaultNameType,
    DataType,
    ResultType,
    NameType
  >;

  private bullWorker?: BullWorker;

  private readonly eventEmitter = new EventEmitter();

  readonly jobEntityClass?: EntityClass<JobEntity>;

  constructor(
    readonly name: NameType,
    private readonly options: QueueModuleOptions,
  ) {
    this.bullQueue = new BullQueue<
      DataTypeOrJob,
      DefaultResultType,
      DefaultNameType,
      DataType,
      ResultType,
      NameType
    >(name, options);

    this.bullQueue.on("waiting", (job) =>
      this.eventEmitter.emit("waiting", job),
    );
  }

  private async upsertDatabase(job: Job, status: JobStatus): Promise<void> {
    const { entityManager, jobEntityClass } = this.options.database ?? {};

    if (
      typeof entityManager !== "undefined" &&
      typeof jobEntityClass !== "undefined" &&
      job.id !== "undefined"
    ) {
      const data = {
        id: job.id,
        name: job.name,
        queueName: job.queueName,
        data: job.data,
        result: job.returnvalue ?? null,
        failedReason: job.failedReason,
        progress: typeof job.progress === "number" ? job.progress : 0,
        status,
        startedAt: job.processedOn ? new Date(job.processedOn) : null,
        settledAt: job.finishedOn ? new Date(job.finishedOn) : null,
        createdAt: new Date(job.timestamp),
        updatedAt: new Date(),
      };

      await entityManager.fork().upsert(jobEntityClass, data);
    }
  }

  private generateJobOptions<T extends JobOptions | BulkJobOptions>(
    opts?: T,
  ): T {
    return {
      ...(!opts?.jobId && !(opts as JobOptions)?.repeat
        ? { jobId: randomUUID() }
        : {}),
      ...(opts ?? {}),
    } as T;
  }

  createWorker(processor?: Processor): void {
    this.bullWorker = new BullWorker(this.name, processor, {
      autorun: false,
      metrics: {
        maxDataPoints: MetricsTime.TWO_WEEKS,
      },
      ...this.options,
    });

    this.bullWorker.on("active", (job) =>
      this.eventEmitter.emit("active", job),
    );

    this.bullWorker.on("progress", (job) =>
      this.eventEmitter.emit("progress", job),
    );

    this.bullWorker.on("completed", (job) =>
      this.eventEmitter.emit("completed", job),
    );

    this.bullWorker.on("failed", (job) =>
      this.eventEmitter.emit("failed", job),
    );
  }

  async runWorker(): Promise<void> {
    return await this.bullWorker?.run();
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  add(
    name: NameType,
    data: DataType,
    opts?: JobOptions,
  ): Promise<Job<DataType, ResultType, NameType>> {
    return this.bullQueue.add(name, data, this.generateJobOptions(opts));
  }

  addBulk(
    jobs: {
      name: NameType;
      data: DataType;
      opts?: BulkJobOptions;
    }[],
  ): Promise<Job<DataType, ResultType, NameType>[]> {
    return this.bullQueue.addBulk(
      jobs.map((job) => ({
        ...job,
        opts: this.generateJobOptions(job.opts),
      })),
    );
  }

  getRepeatableJobs(): Promise<RepeatableJob[]> {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return this.bullQueue.getRepeatableJobs();
  }

  removeRepeatableByKey(key: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return this.bullQueue.removeRepeatableByKey(key);
  }

  async close(): Promise<void> {
    if ((await this.bullQueue.client).status === "ready") {
      await this.bullQueue.close();
    }

    if (this.bullWorker && (await this.bullWorker.client).status === "ready") {
      await this.bullWorker.close();
    }
  }
}
