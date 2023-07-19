import { HealthCheckRegistry } from "@nest-boot/health-check";
import { Module, type OnApplicationShutdown, Optional } from "@nestjs/common";
import { type RedisOptions } from "ioredis";

import { Redis } from "./redis";
import { RedisHealthIndicator } from "./redis.health-indicator";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./redis.module-definition";

@Module({
  providers: [
    {
      provide: Redis,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: RedisOptions) => new Redis(options),
    },
    RedisHealthIndicator,
  ],
  exports: [Redis],
})
export class RedisModule
  extends ConfigurableModuleClass
  implements OnApplicationShutdown
{
  constructor(
    private readonly redis: Redis,
    private readonly healthIndicator: RedisHealthIndicator,
    @Optional()
    private readonly healthCheckRegistry?: HealthCheckRegistry,
  ) {
    super();
  }

  onModuleInit(): void {
    if (typeof this.healthCheckRegistry !== "undefined") {
      this.healthCheckRegistry.register(async () =>
        this.healthIndicator.pingCheck("redis"),
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
