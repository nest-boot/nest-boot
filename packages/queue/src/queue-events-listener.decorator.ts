import { Injectable, type Type } from "@nestjs/common";
import type { QueueEventsOptions } from "bullmq";

import type { BaseQueue } from "./base-queue.js";
import { QUEUE_EVENTS_OPTIONS } from "./queue.constants.js";

/** Event stream settings; connection and namespace come from the queue. */
export type QueueEventsListenerOptions = Omit<
  QueueEventsOptions,
  "connection" | "prefix" | "telemetry"
>;

/**
 * Event listener declaration read during startup.
 * @internal
 */
export interface QueueEventsDefinition {
  queue: Type<BaseQueue>;
  options: QueueEventsListenerOptions;
}

/**
 * Declares an explicit queue event listener. Persistence does not use QueueEvents.
 * @param queue - Queue class registered in this application.
 * @param options - Redis event stream options.
 * @returns Queue event listener class decorator.
 */
export function QueueEventsListener(
  queue: Type<BaseQueue>,
  options: QueueEventsListenerOptions = {},
): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(QUEUE_EVENTS_OPTIONS, { queue, options }, target);
    Injectable()(target);
  };
}
