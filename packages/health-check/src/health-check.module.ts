import { Global, Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthCheckService } from "./health-check.service";
import { HealthCheckRegistry } from "./health-check-registry.service";

@Global()
@Module({
  imports: [TerminusModule],
  providers: [HealthCheckService, HealthCheckRegistry],
  exports: [HealthCheckService, HealthCheckRegistry],
})
export class HealthCheckModule {}
