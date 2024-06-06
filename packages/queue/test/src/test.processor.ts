import { Job, JobProcessor, Processor } from "../../src";
import { TEST_JOB_NAME } from "./constants";

@Processor(TEST_JOB_NAME)
export class TestProcessor implements JobProcessor {
  job?: Job;

  // eslint-disable-next-line @typescript-eslint/require-await
  async process(job: Job): Promise<void> {
    this.job = job;
    return job.data;
  }
}
