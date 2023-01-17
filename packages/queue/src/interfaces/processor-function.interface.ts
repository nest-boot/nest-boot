import { Job } from "./job.interface";

export type ProcessorFunction<T = any, R = any, N extends string = string> = (
  job: Job<T, R, N>,
  token?: string
) => Promise<R>;
