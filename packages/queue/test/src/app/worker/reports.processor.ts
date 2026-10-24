import { BaseProcessor, type Job, Processor } from "@nest-boot/queue";

import { ReportsQueue } from "./reports.queue.js";

@Processor(ReportsQueue)
export class ReportsProcessor extends BaseProcessor {
  async processReport(job: Job<ReportsQueue, "report">) {
    console.log(`ACTIVE:${String(job.id)}`);
    await new Promise((resolve) => setTimeout(resolve, job.data.delay ?? 0));
    console.log(`DONE:${String(job.id)}`);
    return "processed";
  }
}
