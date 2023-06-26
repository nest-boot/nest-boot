import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
} from "@nestjs/terminus";

import { HealthCheckRegistry } from "./health-check-registry.service";

@Controller("/health")
export class HealthCheckController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly healthCheckRegistry: HealthCheckRegistry
  ) {}

  @Get()
  @HealthCheck()
  async handle(): Promise<HealthCheckResult> {
    return await this.healthCheckService.check(
      this.healthCheckRegistry.healthIndicators
    );
  }
}
