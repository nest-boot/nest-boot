import { Inject, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";

import { Job, JobProcessor, Processor } from "../../src";
import {
  TEST_REQUEST_SCOPED_PROCESSOR_JOB_NAME,
  TEST_REQUEST_SCOPED_QUEUE_NAME,
} from "./constants";

@Processor(TEST_REQUEST_SCOPED_PROCESSOR_JOB_NAME, {
  scope: Scope.REQUEST,
  queue: TEST_REQUEST_SCOPED_QUEUE_NAME,
})
export class TestRequestScopedProcessor implements JobProcessor {
  static job?: Job;

  constructor(@Inject(REQUEST) readonly job: Job) {
    TestRequestScopedProcessor.job = job;
  }

  process() {
    return this.job.data;
  }
}
