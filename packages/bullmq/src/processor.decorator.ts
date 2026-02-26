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
 * Decorator to mark a class as a BullMQ processor.
 * It wraps the process method with RequestContext to provide context isolation for each job.
 *
 * @param queueName - The name of the queue.
 */
export function Processor(queueName: string): ClassDecorator;

/**
 * Decorator to mark a class as a BullMQ processor with worker options.
 *
 * @param queueName - The name of the queue.
 * @param workerOptions - Options for the worker.
 */
export function Processor(
  queueName: string,
  workerOptions: NestWorkerOptions,
): ClassDecorator;

/**
 * Decorator to mark a class as a BullMQ processor with processor options.
 *
 * @param processorOptions - Options for the processor.
 */
export function Processor(processorOptions: ProcessorOptions): ClassDecorator;

/**
 * Decorator to mark a class as a BullMQ processor with processor and worker options.
 *
 * @param processorOptions - Options for the processor.
 * @param workerOptions - Options for the worker.
 */
export function Processor(
  processorOptions: ProcessorOptions,
  workerOptions: NestWorkerOptions,
): ClassDecorator;

/**
 * Implementation of the Processor decorator.
 */
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
