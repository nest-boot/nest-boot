import { Connection, MikroORM } from "@mikro-orm/core";
import {
  checkPackages,
  DatabaseNotConnectedError,
  HealthIndicatorResult,
  HealthIndicatorService,
  promiseTimeout,
  PromiseTimeoutError,
} from "@nest-boot/health-check";
import { Injectable, Scope } from "@nestjs/common";

import { DatabaseHealthCheckOptions } from "./interfaces";

@Injectable({ scope: Scope.TRANSIENT })
export class DatabaseHealthIndicator {
  constructor(
    private orm: MikroORM,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {
    this.checkDependantPackages();
  }

  public async pingCheck(
    key: string,
    options?: DatabaseHealthCheckOptions,
  ): Promise<HealthIndicatorResult> {
    this.checkDependantPackages();

    const connection = options?.connection ?? this.orm.em.getConnection();
    const timeout = options?.timeout ?? 1000;

    const check = this.healthIndicatorService.check(key);

    if (!connection) {
      return check.down({ database: "connection not found" });
    }

    try {
      await this.checkConnection(connection, timeout);

      if (options?.checkQuery) {
        await connection.execute(options.checkQuery);
      }
    } catch (error) {
      if (error instanceof PromiseTimeoutError) {
        return check.down(`timeout of ${String(timeout)}ms exceeded`);
      }

      if (error instanceof DatabaseNotConnectedError) {
        return check.down(error.message);
      }

      return check.down();
    }

    return check.up();
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

    await promiseTimeout(timeout, checker());
  }
}
