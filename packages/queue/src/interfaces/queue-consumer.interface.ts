import { Job } from "./job.interface";

export interface QueueConsumer<
  DataType = any,
  ReturnType = any,
  NameType extends string = string,
> {
  consume(job: Job<DataType, ReturnType, NameType>): Promise<ReturnType>;
}
