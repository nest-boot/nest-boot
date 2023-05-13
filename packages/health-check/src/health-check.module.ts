import { Global, Module, type Type } from "@nestjs/common";
import { type HealthIndicator, TerminusModule } from "@nestjs/terminus";

import { HealthCheckController } from "./health-check.controller";
import { HealthCheckRegistryService } from "./health-check-registry.service";
import { RedisHealthIndicator } from "./health-indicators/redis.health-indicator";

const healthIndicators: Array<Type<HealthIndicator>> = [RedisHealthIndicator];

@Global()
@Module({
  imports: [TerminusModule],
  controllers: [HealthCheckController],
  providers: [HealthCheckRegistryService, ...healthIndicators],
  exports: [TerminusModule, HealthCheckRegistryService, ...healthIndicators],
})
export class HealthCheckModule {}
