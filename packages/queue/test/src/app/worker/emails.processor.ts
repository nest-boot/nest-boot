import { BaseProcessor, type Job, Processor } from "@nest-boot/queue";

import { EmailsQueue } from "./emails.queue.js";

@Processor(EmailsQueue)
export class EmailsProcessor extends BaseProcessor {
  async processEmail(job: Job<EmailsQueue, "email">) {
    console.log(`ACTIVE:${String(job.id)}`);
    await new Promise((resolve) => setTimeout(resolve, job.data.delay ?? 0));
    console.log(`DONE:${String(job.id)}`);
    return "processed";
  }
}
