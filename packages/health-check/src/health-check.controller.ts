import { Controller, Get } from "@nestjs/common";
import { HealthCheck, type HealthCheckResult } from "@nestjs/terminus";

import { HealthCheckService } from "./health-check.service.js";

/** Exposes registered health checks at GET /api/health. */
@Controller("api/health")
export class HealthCheckController {
  /**
   * Creates the health check controller.
   * @param healthCheckService - Service that executes the registered indicators
   */
  constructor(private readonly healthCheckService: HealthCheckService) {}

  /**
   * Runs the registered indicators for the current request.
   * @returns The aggregated health result, or a 503 exception for unhealthy checks
   */
  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.healthCheckService.check();
  }
}
