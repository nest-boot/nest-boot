import { Can } from "@nest-boot/common";
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

  @Can("PUBLIC")
  @Get()
  @HealthCheck()
  handle(): Promise<HealthCheckResult> {
    return this.healthCheckService.check(
      this.healthCheckRegistryService.healthIndicatorFunctions
    );
  }
}
