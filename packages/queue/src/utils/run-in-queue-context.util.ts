import { RequestContext } from "@nest-boot/request-context";
import { JOB_REF } from "@nestjs/bullmq";
import type { Job } from "bullmq";

/** Values available when entering a job processor or event handler. @internal */
export interface QueueContextOptions {
  id?: string;
  job?: Job;
}

/** Runs one callback and its middleware in an independent queue context. @internal */
export async function runInQueueContext<T>(
  options: QueueContextOptions,
  callback: () => T | Promise<T>,
): Promise<T> {
  const context = new RequestContext({
    id: options.id ?? options.job?.id,
    type: "queue",
  });

  if (options.job) context.set(JOB_REF, options.job);

  return await RequestContext.run(context, callback);
}
