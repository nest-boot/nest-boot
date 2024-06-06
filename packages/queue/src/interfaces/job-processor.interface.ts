import { Job } from "./job.interface";

export interface JobProcessor<
  DataType = any,
  ReturnType = any,
  NameType extends string = string,
> {
  process(job: Job<DataType, ReturnType, NameType>): Promise<ReturnType>;
}
