import { Connection, MikroORM } from "@mikro-orm/core";
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
  promiseTimeout,
  PromiseTimeoutError,
  TimeoutError,
} from "@nest-boot/health-check";
import { Injectable, Scope } from "@nestjs/common";

export interface DatabasePingCheckSettings {
  timeout?: number;
}

@Injectable({ scope: Scope.TRANSIENT })
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly orm: MikroORM) {
    super();
  }

  public async pingCheck(
    key: string,
    options: DatabasePingCheckSettings = {},
  ): Promise<HealthIndicatorResult> {
    let isHealthy = false;

    const connection = this.orm.em.getConnection();
    const timeout = options.timeout ?? 1000;

    try {
      isHealthy = await this.pingDb(connection, timeout);
    } catch (error) {
      if (error instanceof PromiseTimeoutError) {
        throw new TimeoutError(
          timeout,
          this.getStatus(key, false, {
            message: `timeout of ${timeout}ms exceeded`,
          }),
        );
      }

      if (error instanceof Error) {
        throw new HealthCheckError(
          error.message,
          this.getStatus(key, false, {
            message: error.message,
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

  private async pingDb(connection: Connection, timeout: number) {
    return (await promiseTimeout(timeout, connection.isConnected())) as boolean;
  }
}
