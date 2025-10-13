import { RequestContext } from "@nest-boot/request-context";
import {
  JOB_REF,
  Processor as BaseProcessor,
  WorkerHost,
} from "@nestjs/bullmq";
import { Type } from "@nestjs/common";
import { Job, Worker } from "bullmq";

export function Processor<T extends Worker = Worker>(
  ...args: Parameters<typeof BaseProcessor>
) {
  return (target: Type<WorkerHost<T>>) => {
    const originalProcess = target.prototype.process;
    if (originalProcess) {
      target.prototype.process = async function (job: Job) {
        const ctx = new RequestContext({
          id: job.id,
          type: "queue",
        });

        ctx.set(JOB_REF, job);

        return await RequestContext.run(ctx, () =>
          originalProcess.call(this, job),
        );
      };
    }

    BaseProcessor(...args)(target);
  };
}
