import { Consumer, Job, QueueConsumer } from "../../src";
import { TEST_JOB_NAME } from "./constants";

@Consumer(TEST_JOB_NAME)
export class TestConsumer implements QueueConsumer {
  job?: Job;

  consume(job: Job): void | Promise<void> {
    this.job = job;
  }
}
