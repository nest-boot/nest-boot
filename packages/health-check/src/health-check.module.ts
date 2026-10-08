import { Global, Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthCheckController } from "./health-check.controller.js";
import { HealthCheckService } from "./health-check.service.js";
import { HealthCheckRegistry } from "./health-check-registry.service.js";

/** Provides a shared health check registry, service, and GET /api/health endpoint. */
@Global()
@Module({
  imports: [TerminusModule],
  controllers: [HealthCheckController],
  providers: [HealthCheckService, HealthCheckRegistry],
  exports: [HealthCheckService, HealthCheckRegistry],
})
export class HealthCheckModule {}
