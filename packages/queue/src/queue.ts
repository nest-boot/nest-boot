import { Queue as BullQueue } from "bullmq";
import { randomUUID } from "crypto";

import { BulkJobOptions, Job, JobOptions } from "./interfaces";

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
> extends BullQueue<
  DataTypeOrJob,
  DefaultResultType,
  DefaultNameType,
  DataType,
  ResultType,
  NameType
> {
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

  add(
    name: NameType,
    data: DataType,
    opts?: JobOptions,
  ): Promise<Job<DataType, ResultType, NameType>> {
    return super.add(name, data, this.generateJobOptions(opts));
  }

  addBulk(
    jobs: {
      name: NameType;
      data: DataType;
      opts?: BulkJobOptions;
    }[],
  ): Promise<Job<DataType, ResultType, NameType>[]> {
    return super.addBulk(
      jobs.map((job) => ({
        ...job,
        opts: this.generateJobOptions(job.opts),
      })),
    );
  }
}
