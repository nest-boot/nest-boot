import { Job as BaseJob } from "bullmq";

import { JobOptions } from "./job-options.interface";

export interface Job<
  DataType = any,
  ReturnType = any,
  NameType extends string = string
> extends BaseJob<DataType, ReturnType, NameType> {
  opts: JobOptions;
}
