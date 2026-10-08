import {
  HealthCheckRegistry,
  type HealthIndicatorResult,
  HealthIndicatorService,
} from "@nest-boot/health-check";
import { Injectable, type OnModuleInit, Optional } from "@nestjs/common";
import { Redis } from "ioredis";

/** Checks the existing Redis connection and registers it when health checks are enabled. */
@Injectable()
export class RedisHealthIndicator implements OnModuleInit {
  private readonly healthIndicator = new HealthIndicatorService();

  /**
   * Creates a Redis health indicator without opening another connection.
   * @param redis - The client provided by RedisModule
   * @param registry - Optional application health check registry
   */
  constructor(
    private readonly redis: Redis,
    @Optional() private readonly registry?: HealthCheckRegistry,
  ) {}

  /** Registers a Redis check when HealthCheckModule is present. */
  onModuleInit(): void {
    this.registry?.register(() => this.pingCheck());
  }

  /**
   * Checks Redis readiness and executes PING within the timeout.
   * @param key - Indicator key, defaults to redis
   * @param timeout - Maximum check duration in milliseconds, defaults to 1000
   * @returns An up or down result suitable for HealthCheckRegistry
   */
  async pingCheck(
    key = "redis",
    timeout = 1000,
  ): Promise<HealthIndicatorResult> {
    return await this.healthIndicator
      .check(key)
      .attempt(async () => {
        if (this.redis.status !== "ready") {
          throw new Error("Redis connection is not ready");
        }
        if ((await this.redis.ping()) !== "PONG") {
          throw new Error("Redis returned an unexpected PING response");
        }
      })
      .withTimeout(timeout);
  }
}
