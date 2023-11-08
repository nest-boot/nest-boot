import { Inject, Injectable, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";

import { Job, LegacyProcessor } from "../../src";
import { TEST_REQUEST_SCOPED_JOB_NAME } from "./constants";

@Injectable({ scope: Scope.REQUEST })
export class TestRequestScopedLegacyProcessor {
  static job?: Job;

  constructor(@Inject(REQUEST) readonly job: Job) {
    TestRequestScopedLegacyProcessor.job = job;
  }

  @LegacyProcessor(TEST_REQUEST_SCOPED_JOB_NAME)
  async process(): Promise<void> {
    //
  }
}
