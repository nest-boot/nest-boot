import { RequestContext } from "@nest-boot/request-context";
import { REQUEST as JOB_REF } from "@nestjs/core";
import type { Job as BullmqJob } from "bullmq";

/**
 * Runs one callback and its middleware in an independent queue context.
 * @param job - Job bound to the request context.
 * @param callback - Work to execute in the supplied context.
 * @returns Handler result within the queue request context.
 * @internal
 */
export async function runInQueueContext<T>(
  job: BullmqJob,
  callback: () => T | Promise<T>,
): Promise<T> {
  const context = new RequestContext({
    id: job.id,
    type: "queue",
  });

  context.set(JOB_REF, job);

  return await RequestContext.run(context, callback);
}
