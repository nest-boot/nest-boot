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
    private readonly healthCheckService: HealthCheckService,
    private readonly healthCheckRegistryService: HealthCheckRegistryService
  ) {}

  @Get()
  @HealthCheck()
  async handle(): Promise<HealthCheckResult> {
    return await this.healthCheckService.check(
      this.healthCheckRegistryService.healthIndicatorFunctions
    );
  }
}
