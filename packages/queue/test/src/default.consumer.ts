import { Consumer, Job, QueueConsumer } from "../../src";

@Consumer()
export class DefaultConsumer implements QueueConsumer {
  job?: Job;

  // eslint-disable-next-line @typescript-eslint/require-await
  async consume(job: Job): Promise<void> {
    this.job = job;
  }
}
