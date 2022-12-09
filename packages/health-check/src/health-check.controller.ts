import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from "@nestjs/terminus";

import { HealthCheckRegistryService } from "./health-check-registry.service";

@Controller("/health")
export class HealthCheckController {
  constructor(
    private healthCheckService: HealthCheckService,
    private healthCheckRegistryService: HealthCheckRegistryService
  ) {}

  @Get()
  @HealthCheck()
  handle(): Promise<HealthCheckResult> {
    return this.healthCheckService.check(
      this.healthCheckRegistryService.healthIndicatorFunctions
    );
  }
}
