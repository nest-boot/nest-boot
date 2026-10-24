import type { BaseQueue } from "@nest-boot/queue";
import type { Type } from "@nestjs/common";

const QUEUE_VISIBLE = Symbol("QUEUE_VISIBLE");

/**
 * Allows a registered queue's Job records to appear in scoped API queries.
 * @returns Queue class decorator. Authorization still applies to every query.
 */
export function QueueVisible() {
  return (target: Type<BaseQueue>): void => {
    Reflect.defineMetadata(QUEUE_VISIBLE, true, target);
  };
}

/**
 * Checks whether a queue class explicitly enables API queries.
 * @param queue - Registered queue instance.
 * @returns Whether the concrete queue class has its own visibility marker.
 * @internal
 */
export function isQueueVisible(queue: BaseQueue): boolean {
  return Reflect.getOwnMetadata(QUEUE_VISIBLE, queue.constructor) === true;
}
