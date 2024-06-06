import { Consumer, Job, QueueConsumer } from "../../src";
import { TEST_QUEUE_NAME } from "./constants";

@Consumer(TEST_QUEUE_NAME)
export class TestConsumer implements QueueConsumer {
  job?: Job;

  consume(job: Job) {
    this.job = job;
    return job.data;
  }
}
