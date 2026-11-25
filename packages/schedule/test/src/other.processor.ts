import { BaseProcessor, type Job, Processor } from "@nest-boot/queue";

import { OtherQueue } from "./other.queue.js";

@Processor(OtherQueue)
export class OtherProcessor extends BaseProcessor {
  async processPing(_job: Job<OtherQueue, "ping">): Promise<string> {
    await Promise.resolve();
    return "pong";
  }
}
