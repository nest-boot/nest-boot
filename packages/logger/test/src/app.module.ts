import { Module } from "@nestjs/common";

import { LoggerModule } from "../../src/index.js";
import { TestService } from "./test.service.js";
import { TestRequestScopedService } from "./test-request-scoped.service.js";

@Module({
  imports: [LoggerModule],
  providers: [TestService, TestRequestScopedService],
})
export class AppModule {}
