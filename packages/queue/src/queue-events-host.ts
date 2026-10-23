import type { PostgresQueueEvents as QueueEvents } from "./postgres.js";
import { QUEUE_EVENTS_REF } from "./queue.constants.js";

/** Base class for explicit PostgreSQL queue event listeners. */
export abstract class QueueEventsHost {
  /** @internal */
  [QUEUE_EVENTS_REF]?: QueueEvents;

  /**
   * The event stream is available after QueueRegistrar.start().
   * @returns The initialized event stream.
   */
  get queueEvents(): QueueEvents {
    const events = this[QUEUE_EVENTS_REF];
    if (!events) {
      throw new Error(
        "Queue events are not initialized; call QueueRegistrar.start() first.",
      );
    }
    return events;
  }
}
