import { Inject, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";

import { Job, JobProcessor, Processor } from "../../src";
import { TEST_REQUEST_SCOPED_JOB_NAME } from "./constants";

@Processor(TEST_REQUEST_SCOPED_JOB_NAME, { scope: Scope.REQUEST })
export class TestRequestScopedProcessor implements JobProcessor {
  static job?: Job;

  constructor(@Inject(REQUEST) readonly job: Job) {
    TestRequestScopedProcessor.job = job;
  }

  process() {
    return this.job.data;
  }
}
