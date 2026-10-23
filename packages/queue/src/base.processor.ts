import type { Job } from "bullmq";

import type { ProcessorOptions } from "./decorators/processor.decorator.js";
import type { PostgresWorker as Worker } from "./postgres.js";
import { WORKER_REF } from "./queue.constants.js";

/** Base class for a consumer registered with `@Processor()`. */
export abstract class BaseProcessor<T extends Worker = Worker> {
  /**
   * Supplies worker settings derived from this singleton's injected dependencies.
   * @param workerOptions - Overrides for the declared worker settings.
   */
  constructor(
    readonly workerOptions: Omit<ProcessorOptions, "scope" | "durable"> = {},
  ) {}

  /** @internal */
  [WORKER_REF]?: T;

  /**
   * The worker is available after QueueRegistrar.start().
   * @returns The initialized worker.
   */
  get worker(): T {
    const worker = this[WORKER_REF];
    if (!worker) {
      throw new Error(
        "Worker is not initialized; call QueueRegistrar.start() first.",
      );
    }
    return worker;
  }

  /**
   * Processes a queued job. Rejections are handled by BullMQ's retry policy.
   * @param job - Current job.
   * @param token - Worker lock token.
   * @param signal - Optional cancellation signal.
   * @returns The job result.
   */
  abstract process(
    job: Job,
    token?: string,
    signal?: AbortSignal,
  ): Promise<any>;
}
