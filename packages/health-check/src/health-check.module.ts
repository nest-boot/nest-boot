import { Global, Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthCheckService } from "./health-check.service.js";
import { HealthCheckRegistry } from "./health-check-registry.service.js";

/** Provides a shared health check registry and service without adding routes. */
@Global()
@Module({
  imports: [TerminusModule],
  providers: [HealthCheckService, HealthCheckRegistry],
  exports: [HealthCheckService, HealthCheckRegistry],
})
export class HealthCheckModule {}
