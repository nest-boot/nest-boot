import { Job, LegacyProcessor } from "../../src";
import { TEST_JOB_NAME } from "./constants";

export class TestLegacyProcessor {
  job?: Job;

  // eslint-disable-next-line @typescript-eslint/require-await
  @LegacyProcessor(TEST_JOB_NAME)
  async process(job: Job): Promise<void> {
    this.job = job;
  }
}
