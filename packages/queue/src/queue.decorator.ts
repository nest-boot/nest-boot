import { type Abstract, Injectable } from "@nestjs/common";

import type { BaseQueue } from "./base-queue.js";
import { QUEUE_OPTIONS } from "./queue.constants.js";
import type { QueueDefinition } from "./queue-options.interface.js";

/**
 * Declares a queue; add the decorated class to its module's providers.
 * @param options - Queue name and shared producer/consumer configuration.
 * @returns The queue class decorator.
 */
export function Queue(options: QueueDefinition): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(QUEUE_OPTIONS, options, target);
    Injectable()(target);
  };
}

/**
 * Reads a queue declaration without opening a database connection.
 * @param target - Declared queue class.
 * @returns The queue configuration.
 */
export function getQueueDefinition(
  target: Abstract<BaseQueue>,
): QueueDefinition {
  const definition = Reflect.getMetadata(QUEUE_OPTIONS, target) as
    | QueueDefinition
    | undefined;
  if (!definition?.name)
    throw new Error(`Queue class "${target.name}" requires @Queue({ name }).`);
  return definition;
}
