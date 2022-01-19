import { Injectable, Scope } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import {
  ConnectionNotFoundError,
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
  TimeoutError,
} from "@nestjs/terminus";
import { checkPackages, promiseTimeout } from "@nestjs/terminus/dist/utils";
import { Redis } from "@nest-boot/redis";
import { parse } from "redis-info";

export interface RedisPingCheckSettings {
  client?: Redis;

  timeout?: number;

  memoryMaximumUtilization?: number;
}

@Injectable({ scope: Scope.TRANSIENT })
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private moduleRef: ModuleRef) {
    super();
    this.checkDependantPackages();
  }

  async pingCheck(
    key: string,
    options: RedisPingCheckSettings = {}
  ): Promise<HealthIndicatorResult> {
    this.checkDependantPackages();

    let isHealthy = false;

    const { client, timeout = 1000, memoryMaximumUtilization = 80 } = options;

    if (!client) {
      throw new ConnectionNotFoundError(
        this.getStatus(key, isHealthy, {
          message: "Connection provider not found in application context",
        })
      );
    }

    try {
      await promiseTimeout(
        timeout,
        (async () => {
          const info = parse(await client.info());

          const currentMemoryMaximumUtilization =
            info.maxmemory === "0"
              ? 0
              : Number(info.used_memory) / Number(info.maxmemory);

          if (currentMemoryMaximumUtilization > memoryMaximumUtilization) {
            throw new HealthCheckError(
              "Used memory exceeded the set maximum utilization",
              this.getStatus(key, isHealthy, {
                message: "Used memory exceeded the set maximum utilization",
              })
            );
          }

          return info;
        })()
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
          })
        );
      }
    }

    if (isHealthy) {
      return this.getStatus(key, isHealthy);
    }

    throw new HealthCheckError(
      `${key} is not available`,
      this.getStatus(key, isHealthy)
    );
  }

  private checkDependantPackages(): void {
    checkPackages(["@nest-boot/redis", "redis-info"], this.constructor.name);
  }
}
