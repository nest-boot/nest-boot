import { Logger } from "@nest-boot/common";
import { BaseQueue, Queue } from "@nest-boot/queue";

@Queue()
export class TestQueue extends BaseQueue {
  private logger = new Logger(TestQueue.name);

  async processor(): Promise<void> {
    this.logger.log("processing", { date: new Date() });
  }
}
