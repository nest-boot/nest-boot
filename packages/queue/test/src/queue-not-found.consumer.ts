import { Consumer, Job, QueueConsumer } from "../../src";
import { QUEUE_NOT_FOUND_QUEUE_NAME } from "./constants";

@Consumer(QUEUE_NOT_FOUND_QUEUE_NAME)
export class QueueNotFoundConsumer implements QueueConsumer {
  job?: Job;

  // eslint-disable-next-line @typescript-eslint/require-await
  async consume(job: Job): Promise<void> {
    this.job = job;
  }
}
