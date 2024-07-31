import { RequireAuth } from "@nest-boot/auth";
import {
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
} from "@nest-boot/health-check";
import { Controller, Get } from "@nestjs/common";

@RequireAuth(false)
@Controller("/health")
export class HealthCheckController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return await this.healthCheckService.check();
  }
}
