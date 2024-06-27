import { Queue as BullQueue } from "bullmq";
import { randomUUID } from "crypto";

import { BulkJobOptions, Job, JobOptions } from "./interfaces";

export class Queue<
  DataType = any,
  ResultType = any,
  NameType extends string = string,
> extends BullQueue<DataType, ResultType, NameType> {
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

  async add(
    name: NameType,
    data: DataType,
    opts?: JobOptions,
  ): Promise<Job<DataType, ResultType, NameType>> {
    return await super.add(name, data, this.generateJobOptions(opts));
  }

  async addBulk(
    jobs: {
      name: NameType;
      data: DataType;
      opts?: BulkJobOptions;
    }[],
  ): Promise<Job<DataType, ResultType, NameType>[]> {
    return await super.addBulk(
      jobs.map((job) => ({
        ...job,
        opts: this.generateJobOptions(job.opts),
      })),
    );
  }
}
