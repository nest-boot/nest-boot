import {
  HealthIndicatorService,
  promiseTimeout,
  PromiseTimeoutError,
} from "@nest-boot/health-check";
import { type HealthIndicatorResult } from "@nest-boot/health-check";
import { Injectable, Scope } from "@nestjs/common";
import { parse } from "redis-info";

import { Redis } from "./redis";

export interface RedisPingCheckSettings {
  timeout?: number;

  /**
   * 内存最大使用率百分比 (0-100)
   */
  memoryMaximumUtilization?: number;
}

@Injectable({ scope: Scope.TRANSIENT })
export class RedisHealthIndicator {
  constructor(
    private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(
    key: string,
    options: RedisPingCheckSettings = {},
  ): Promise<HealthIndicatorResult> {
    const { timeout = 1000, memoryMaximumUtilization = 80 } = options;

    const check = this.healthIndicatorService.check(key);

    try {
      await promiseTimeout(
        timeout,
        (async () => {
          const info = parse(await this.redis.info());

          // 检查内存使用率
          if (info.maxmemory && info.maxmemory !== "0") {
            const maxMemory = Number(info.maxmemory);
            const usedMemory = Number(info.used_memory);

            if (maxMemory > 0) {
              const currentMemoryUtilizationPercent =
                (usedMemory / maxMemory) * 100;

              if (currentMemoryUtilizationPercent > memoryMaximumUtilization) {
                throw new Error(
                  `Used memory exceeded the set maximum utilization: ${currentMemoryUtilizationPercent.toFixed(2)}% > ${String(memoryMaximumUtilization)}%`,
                );
              }
            }
          }

          return info;
        })(),
      );

      return check.up();
    } catch (err) {
      if (err instanceof PromiseTimeoutError) {
        return check.down(`timeout of ${String(timeout)}ms exceeded`);
      }

      if (err instanceof Error) {
        return check.down(err.message);
      }

      return check.down();
    }
  }
}
