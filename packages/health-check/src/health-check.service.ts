import { Injectable } from "@nestjs/common";
import {
  type HealthCheckResult,
  HealthCheckService as TerminusHealthCheckService,
} from "@nestjs/terminus";

import { HealthCheckRegistry } from "./health-check-registry.service.js";

/** Executes all registered health indicators using Terminus. */
@Injectable()
export class HealthCheckService {
  /**
   * Creates the application health check service.
   * @param terminusHealthCheckService - Terminus check executor
   * @param healthCheckRegistry - Shared registry of application checks
   */
  constructor(
    private readonly terminusHealthCheckService: TerminusHealthCheckService,
    private readonly healthCheckRegistry: HealthCheckRegistry,
  ) {}

  /**
   * Runs registered checks and returns Terminus's aggregated result.
   * @returns The health check result; unhealthy checks reject with Terminus's exception
   */
  check(): Promise<HealthCheckResult> {
    return this.terminusHealthCheckService.check(
      this.healthCheckRegistry.healthIndicators,
    );
  }
}
