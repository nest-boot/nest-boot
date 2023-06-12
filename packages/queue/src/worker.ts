import { type RedisConnection, Worker as BaseWorker } from "bullmq";

import { type ProcessorFunction } from "./interfaces/processor-function.interface";
import { type WorkerOptions } from "./interfaces/worker-options.interface";

export class Worker<
  DataType = any,
  ResultType = any,
  NameType extends string = string
> extends BaseWorker<DataType, ResultType, NameType> {
  constructor(
    name: string,
    processor?: string | ProcessorFunction<DataType, ResultType, NameType>,
    opts?: WorkerOptions,
    Connection?: typeof RedisConnection
  ) {
    super(name, processor as any, opts, Connection);
  }
}
