import { Connection, MikroORM } from "@mikro-orm/core";
import {
  checkPackages,
  DatabaseNotConnectedError,
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
  promiseTimeout,
  PromiseTimeoutError,
  TimeoutError,
} from "@nest-boot/health-check";
import { Injectable, Scope } from "@nestjs/common";

import { DatabaseHealthCheckOptions } from "./interfaces";

@Injectable({ scope: Scope.TRANSIENT })
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private orm: MikroORM) {
    super();
    this.checkDependantPackages();
  }

  public async healthCheck(
    key: string,
    options?: DatabaseHealthCheckOptions,
  ): Promise<HealthIndicatorResult> {
    this.checkDependantPackages();

    const connection = options?.connection ?? this.orm.em.getConnection();
    const timeout = options?.timeout ?? 1000;

    if (!connection) {
      return this.getStatus(key, false);
    }

    try {
      await this.checkConnection(connection, timeout);

      if (options?.checkQuery) {
        await connection.execute(options.checkQuery);
      }
    } catch (error) {
      if (error instanceof PromiseTimeoutError) {
        throw new TimeoutError(
          timeout,
          this.getStatus(key, false, {
            message: `timeout of ${String(timeout)}ms exceeded`,
          }),
        );
      }
      if (error instanceof DatabaseNotConnectedError) {
        throw new HealthCheckError(
          error.message,
          this.getStatus(key, false, {
            message: error.message,
          }),
        );
      }

      throw new HealthCheckError(
        `${key} is not available`,
        this.getStatus(key, false),
      );
    }

    return this.getStatus(key, true);
  }

  private checkDependantPackages() {
    checkPackages(
      ["@mikro-orm/nestjs", "@mikro-orm/core"],
      this.constructor.name,
    );
  }

  private async checkConnection(connection: Connection, timeout: number) {
    const checker = async () => {
      const isConnected = await connection.isConnected();
      if (!isConnected) {
        throw new DatabaseNotConnectedError();
      }
    };

    return await promiseTimeout(timeout, checker());
  }
}
