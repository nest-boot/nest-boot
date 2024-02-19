import { Job, JobProcessor, Processor } from "../../src";
import { QUEUE_NOT_FOUND_QUEUE_NAME, TEST_JOB_NAME } from "./constants";

@Processor(TEST_JOB_NAME, { queue: QUEUE_NOT_FOUND_QUEUE_NAME })
export class QueueNotFoundProcessor implements JobProcessor {
  job?: Job;

  // eslint-disable-next-line @typescript-eslint/require-await
  async process(job: Job): Promise<void> {
    this.job = job;
  }
}
