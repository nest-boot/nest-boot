import { Inject, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";

import { Consumer, Job, QueueConsumer } from "../../src";
import { TEST_REQUEST_SCOPED_JOB_NAME } from "./constants";

@Consumer(TEST_REQUEST_SCOPED_JOB_NAME, { scope: Scope.DEFAULT })
export class TestRequestScopedConsumer implements QueueConsumer {
  static job?: Job;

  constructor(@Inject(REQUEST) readonly job: Job) {
    TestRequestScopedConsumer.job = job;
  }

  consume(): void {
    //
  }
}
