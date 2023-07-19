import { Global, Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthCheckController } from "./health-check.controller";
import { HealthCheckRegistry } from "./health-check-registry.service";

@Global()
@Module({
  imports: [TerminusModule],
  controllers: [HealthCheckController],
  providers: [HealthCheckRegistry],
  exports: [TerminusModule, HealthCheckRegistry],
})
export class HealthCheckModule {}
