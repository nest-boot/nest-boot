/* eslint-disable @typescript-eslint/unified-signatures */

import { RequestContext } from "@nest-boot/request-context";
import {
  JOB_REF,
  Processor as BaseProcessor,
  ProcessorOptions,
  WorkerHost,
} from "@nestjs/bullmq";
import { NestWorkerOptions } from "@nestjs/bullmq/dist/interfaces/worker-options.interface";
import { Type } from "@nestjs/common";
import { Job, Worker } from "bullmq";

/**
 * Decorator that marks a class as a BullMQ queue processor.
 *
 * @remarks
 * Wraps the `@nestjs/bullmq` `Processor` decorator to automatically
 * create a {@link RequestContext} for each processed job.
 *
 * @param queueName - The name of the queue to process
 */
export function Processor(queueName: string): ClassDecorator;

/**
 * Decorator that marks a class as a BullMQ queue processor with worker options.
 *
 * @param queueName - The name of the queue to process
 * @param workerOptions - Worker configuration options
 */
export function Processor(
  queueName: string,
  workerOptions: NestWorkerOptions,
): ClassDecorator;

/**
 * Decorator that marks a class as a BullMQ queue processor with processor options.
 *
 * @param processorOptions - Processor configuration options
 */
export function Processor(processorOptions: ProcessorOptions): ClassDecorator;

/**
 * Decorator that marks a class as a BullMQ queue processor with processor and worker options.
 *
 * @param processorOptions - Processor configuration options
 * @param workerOptions - Worker configuration options
 */
export function Processor(
  processorOptions: ProcessorOptions,
  workerOptions: NestWorkerOptions,
): ClassDecorator;

export function Processor<T extends Worker = Worker>(
  queueNameOrOptions?: string | ProcessorOptions,
  maybeWorkerOptions?: NestWorkerOptions,
) {
  return (target: Type<WorkerHost<T>>) => {
    const originalProcess = target.prototype.process;
    if (originalProcess) {
      target.prototype.process = async function (job: Job) {
        const ctx = new RequestContext({
          id: job.id,
          type: "queue",
        });

        ctx.set(JOB_REF, job);

        return await RequestContext.run(ctx, () =>
          originalProcess.call(this, job),
        );
      };
    }

    BaseProcessor(queueNameOrOptions as any, maybeWorkerOptions as any)(target);
  };
}
