import { BaseProcessor, Processor } from "@nest-boot/queue";
import type { Job } from "bullmq";

import { type ReportData, ReportsQueue } from "./reports.queue.js";

@Processor(ReportsQueue)
export class ReportsProcessor extends BaseProcessor {
  async process(job: Job<ReportData>): Promise<string> {
    console.log(`ACTIVE:${String(job.id)}`);
    await new Promise((resolve) => setTimeout(resolve, job.data.delay ?? 0));
    console.log(`DONE:${String(job.id)}`);
    return "processed";
  }
}
