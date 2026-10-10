import { OnWorkerEvent as BaseOnWorkerEvent } from "@nestjs/bullmq";
import type { Job, WorkerListener } from "bullmq";

import { createContextEventDecorator } from "./utils/create-context-event-decorator.util.js";

/**
 * Listens to a worker event in an independent queue request context.
 *
 * Use on a method of a singleton `WorkerHost` registered with `@Processor()`.
 * Job-bearing events bind `JOB_REF`; `stalled` supplies only the context ID.
 * Events without a job ID use a generated context ID. Handler and middleware
 * failures are logged and suppressed because BullMQ does not await listeners.
 * @param eventName - The worker event to observe
 * @returns A method decorator compatible with Nest's worker event discovery
 */
export function OnWorkerEvent(
  eventName: keyof WorkerListener,
): MethodDecorator {
  return createContextEventDecorator(
    eventName,
    BaseOnWorkerEvent(eventName),
    ([first]) => {
      switch (eventName) {
        case "active":
        case "completed":
        case "failed":
        case "progress":
          return { job: first as Job | undefined };
        case "stalled":
          return { id: first as string };
        default:
          return {};
      }
    },
  );
}
