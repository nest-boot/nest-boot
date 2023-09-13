import { Module } from "@nestjs/common";

import { LoggerModule } from "../../src";
import { TestService } from "./test.service";
import { TestRequestScopedService } from "./test-request-scoped.service";

@Module({
  imports: [LoggerModule],
  providers: [TestService, TestRequestScopedService],
})
export class AppModule {}
