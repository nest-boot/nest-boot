import { Queue as BullQueue } from "bullmq";

import { BulkJobOptions, Job, JobOptions } from "./interfaces";

export class Queue<
  DataType = any,
  ResultType = any,
  NameType extends string = string,
> extends BullQueue<DataType, ResultType, NameType> {
  async add(
    name: NameType,
    data: DataType,
    opts?: JobOptions,
  ): Promise<Job<DataType, ResultType, NameType>> {
    return await super.add(name, data, opts);
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
