import { Consumer, Job, QueueConsumer } from "../../src";
import { TEST_QUEUE_NAME } from "./constants";

@Consumer(TEST_QUEUE_NAME)
export class TestConsumer implements QueueConsumer {
  job?: Job;

  // eslint-disable-next-line @typescript-eslint/require-await
  async consume(job: Job): Promise<void> {
    this.job = job;
  }
}
