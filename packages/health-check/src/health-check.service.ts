import { Injectable } from "@nestjs/common";
import type { HealthCheckResult } from "@nestjs/terminus";
import { HealthCheckService as TerminusHealthCheckService } from "@nestjs/terminus";

import { HealthCheckRegistry } from "./health-check-registry.service";

@Injectable()
export class HealthCheckService {
  constructor(
    private readonly terminusHealthCheckService: TerminusHealthCheckService,
    private readonly healthCheckRegistry: HealthCheckRegistry,
  ) {}

  check(): Promise<HealthCheckResult> {
    return this.terminusHealthCheckService.check(
      this.healthCheckRegistry.healthIndicators,
    );
  }
}
