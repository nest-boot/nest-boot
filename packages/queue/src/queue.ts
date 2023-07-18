import { Queue as BaseQueue } from "bullmq";

import { type BulkJobOptions } from "./interfaces/bulk-job-options.interface";
import { type Job } from "./interfaces/job.interface";
import { type JobOptions } from "./interfaces/job-options.interface";

export class Queue<
  DataType = any,
  ResultType = any,
  NameType extends string = string,
> extends BaseQueue<DataType, ResultType, NameType> {
  async add(
    name: NameType,
    data: DataType,
    opts?: JobOptions,
  ): Promise<Job<DataType, ResultType, NameType>> {
    return super.add(name, data, opts);
  }

  async addBulk(
    jobs: {
      name: NameType;
      data: DataType;
      opts?: BulkJobOptions;
    }[],
  ): Promise<Job<DataType, ResultType, NameType>[]> {
    return await super.addBulk(jobs);
  }
}
