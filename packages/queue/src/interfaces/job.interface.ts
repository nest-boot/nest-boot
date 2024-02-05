import { type Job as BaseJob } from "bullmq";

import { type JobOptions } from "./job-options.interface";

export interface Job<
  DataType = any,
  ReturnType = any,
  NameType extends string = string,
> extends BaseJob<DataType, ReturnType, NameType> {
  opts: JobOptions;
}
