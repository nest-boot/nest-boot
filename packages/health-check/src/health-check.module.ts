import { Global, Module, type Type } from "@nestjs/common";
import { type HealthIndicator, TerminusModule } from "@nestjs/terminus";

import { HealthCheckController } from "./health-check.controller";
import { HealthCheckRegistry } from "./health-check-registry.service";
import { RedisHealthIndicator } from "./health-indicators";

const healthIndicators: Array<Type<HealthIndicator>> = [RedisHealthIndicator];

@Global()
@Module({
  imports: [TerminusModule],
  controllers: [HealthCheckController],
  providers: [HealthCheckRegistry, ...healthIndicators],
  exports: [TerminusModule, HealthCheckRegistry, ...healthIndicators],
})
export class HealthCheckModule {}
