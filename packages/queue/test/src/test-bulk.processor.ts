import { Job, JobProcessor, Processor } from "../../src";
import { TEST_BULK_JOB_NAME } from "./constants";

@Processor(TEST_BULK_JOB_NAME)
export class TestBulkProcessor implements JobProcessor {
  jobs: Job[] = [];

  // eslint-disable-next-line @typescript-eslint/require-await
  async process(job: Job): Promise<void> {
    this.jobs?.push(job);
  }
}
