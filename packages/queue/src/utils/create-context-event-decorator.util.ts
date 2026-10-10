import { Logger } from "@nestjs/common";

import {
  type QueueContextOptions,
  runInQueueContext,
} from "./run-in-queue-context.util.js";

/**
 * Wraps an event callback while preserving Nest's discovery metadata.
 * @param eventName - Event whose handler should run in a request context.
 * @param baseDecorator - Underlying BullMQ event decorator.
 * @param getContextOptions - Builds request context options from event arguments.
 * @returns Decorator that runs the event handler in a queue request context.
 * @internal
 */
export function createContextEventDecorator(
  eventName: string,
  baseDecorator: MethodDecorator,
  getContextOptions: (args: unknown[]) => QueueContextOptions,
): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    const logger = new Logger(
      `${target.constructor.name}.${String(propertyKey)}`,
    );

    descriptor.value = async function (...args: unknown[]) {
      try {
        return await runInQueueContext(getContextOptions(args), () =>
          original.apply(this, args),
        );
      } catch (error: unknown) {
        // EventEmitter does not await listeners. Observers must not create
        // unhandled rejections or turn an already completed job into a failure.
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          `Queue event handler failed (${eventName}): ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    };

    for (const key of Reflect.getMetadataKeys(original)) {
      Reflect.defineMetadata(
        key,
        Reflect.getMetadata(key, original),
        descriptor.value,
      );
    }

    return baseDecorator(target, propertyKey, descriptor);
  };
}
