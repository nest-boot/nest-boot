import type { Worker as BullmqWorker } from "bullmq";

import type { ProcessorOptions } from "../interfaces/processor-options.interface.js";
import { WORKER_REF } from "../queue.constants.js";

/** Singleton processor with a managed Worker and named job handlers. */
export abstract class BaseProcessor {
  /** @internal */
  [WORKER_REF]?: BullmqWorker;

  /**
   * Configures the Worker for the statically declared queue.
   * @param workerOptions - Worker settings inherited by the managed transport.
   */
  constructor(readonly workerOptions: ProcessorOptions = {}) {}

  /** @returns The Worker after QueueManager.start(). */
  get worker(): BullmqWorker {
    if (!this[WORKER_REF]) {
      throw new Error(
        "Worker is not initialized; call QueueManager.start() first.",
      );
    }
    return this[WORKER_REF];
  }
}
