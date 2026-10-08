import { OnQueueEvent as BaseOnQueueEvent } from "@nestjs/bullmq";
import type { QueueEventsListener } from "bullmq";

import { createContextEventDecorator } from "./utils/create-context-event-decorator.util.js";

/**
 * Listens to a queue event in an independent queue request context.
 *
 * @remarks
 * Use on a method of a singleton `QueueEventsHost` registered with
 * `@QueueEventsListener()`. The event's `jobId` becomes the context ID when
 * present; otherwise an ID is generated. Queue event payloads are not Jobs,
 * so `JOB_REF` is not bound. Handler and middleware failures are logged and
 * suppressed because BullMQ does not await listeners.
 *
 * @param eventName - The queue event to observe
 * @returns A method decorator compatible with Nest's queue event discovery
 */
export function OnQueueEvent(
  eventName: keyof QueueEventsListener,
): MethodDecorator {
  return createContextEventDecorator(
    eventName,
    BaseOnQueueEvent(eventName),
    ([first]) => ({
      id:
        typeof first === "object" &&
        first !== null &&
        "jobId" in first &&
        typeof first.jobId === "string"
          ? first.jobId
          : undefined,
    }),
  );
}
