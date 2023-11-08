import { Inject, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";

import { Consumer, Job, QueueConsumer } from "../../src";
import { TEST_REQUEST_SCOPED_QUEUE_NAME } from "./constants";

@Consumer(TEST_REQUEST_SCOPED_QUEUE_NAME, { scope: Scope.REQUEST })
export class TestRequestScopedConsumer implements QueueConsumer {
  static job?: Job;

  constructor(@Inject(REQUEST) readonly job: Job) {
    TestRequestScopedConsumer.job = job;
  }

  async consume(): Promise<void> {
    //
  }
}
