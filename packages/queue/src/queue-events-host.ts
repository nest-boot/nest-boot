import type { QueueEvents } from "bullmq";

import { QUEUE_EVENTS_REF } from "./queue.constants.js";

/** Base class for explicit Redis stream event listeners. */
export abstract class QueueEventsHost {
  /** @internal */
  [QUEUE_EVENTS_REF]?: QueueEvents;

  /**
   * The event stream is available after module initialization.
   * @returns The initialized event stream.
   */
  get queueEvents(): QueueEvents {
    const events = this[QUEUE_EVENTS_REF];
    if (!events)
      throw new Error(
        "Queue events are not initialized; access them after onModuleInit.",
      );
    return events;
  }
}
