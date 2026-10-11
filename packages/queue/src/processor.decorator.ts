import { Injectable, type ScopeOptions, type Type } from "@nestjs/common";
import type { WorkerOptions } from "bullmq";

import type { BaseQueue } from "./base-queue.js";
import { PROCESSOR_OPTIONS } from "./queue.constants.js";

/** Consumer options; connection and namespace always come from its queue. */
export type ProcessorOptions = Omit<
  WorkerOptions,
  "connection" | "prefix" | "telemetry"
> &
  ScopeOptions;

/**
 * Consumer declaration read during startup.
 * @internal
 */
export interface ProcessorDefinition {
  queue: Type<BaseQueue>;
  options: ProcessorOptions;
}

/**
 * Declares a consumer of the given queue class.
 * @param queue - Queue class registered as a provider in this application.
 * @param options - Worker and Nest injection scope options.
 * @returns Consumer class decorator.
 */
export function Processor(
  queue: Type<BaseQueue>,
  options: ProcessorOptions = {},
): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(PROCESSOR_OPTIONS, { queue, options }, target);
    Injectable({ scope: options.scope, durable: options.durable })(target);
  };
}
