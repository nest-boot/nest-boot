import { Queue as BaseQueue } from "bullmq";

import { Job } from "./interfaces/job.interface";
import { JobOptions } from "./interfaces/job-options.interface";

export class Queue<
  DataType = any,
  ResultType = any,
  NameType extends string = string
> extends BaseQueue<DataType, ResultType, NameType> {
  async add(
    name: NameType,
    data: DataType,
    opts?: JobOptions | undefined
  ): Promise<Job<DataType, ResultType, NameType>> {
    return super.add(name, data, opts) as any;
  }
}
