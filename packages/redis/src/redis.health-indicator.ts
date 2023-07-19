import { promiseTimeout } from "@nest-boot/health-check";
import {
  HealthCheckError,
  HealthIndicator,
  type HealthIndicatorResult,
  TimeoutError,
} from "@nest-boot/health-check";
import { Injectable, Scope } from "@nestjs/common";
import { parse } from "redis-info";

import { Redis } from "./redis";

export interface RedisPingCheckSettings {
  timeout?: number;

  memoryMaximumUtilization?: number;
}

@Injectable({ scope: Scope.TRANSIENT })
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: Redis) {
    super();
  }

  async pingCheck(
    key: string,
    options: RedisPingCheckSettings = {},
  ): Promise<HealthIndicatorResult> {
    let isHealthy = false;

    const { timeout = 1000, memoryMaximumUtilization = 80 } = options;

    try {
      await promiseTimeout(
        timeout,
        (async () => {
          const info = parse(await this.redis.info());

          const currentMemoryMaximumUtilization =
            info.maxmemory === "0"
              ? 0
              : Number(info.used_memory) / Number(info.maxmemory);

          if (currentMemoryMaximumUtilization > memoryMaximumUtilization) {
            throw new HealthCheckError(
              "Used memory exceeded the set maximum utilization",
              this.getStatus(key, isHealthy, {
                message: "Used memory exceeded the set maximum utilization",
              }),
            );
          }

          return info;
        })(),
      );

      isHealthy = true;
    } catch (err) {
      if (err instanceof HealthCheckError) {
        throw err;
      }

      if (err instanceof TimeoutError) {
        throw new TimeoutError(
          timeout,
          this.getStatus(key, isHealthy, {
            message: `timeout of ${timeout}ms exceeded`,
          }),
        );
      }
    }

    if (isHealthy) {
      return this.getStatus(key, isHealthy);
    }

    throw new HealthCheckError(
      `${key} is not available`,
      this.getStatus(key, isHealthy),
    );
  }
}
