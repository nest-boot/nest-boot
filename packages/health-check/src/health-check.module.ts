import { Global, Module, Type } from "@nestjs/common";
import { HealthIndicator, TerminusModule } from "@nestjs/terminus";

import { HealthCheckRegistryService } from "./health-check-registry.service";
import { HealthCheckController } from "./health-check.controller";
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
