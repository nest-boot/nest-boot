import type {
  AnyEntity,
  Configuration,
  EntityData,
  LoggingOptions,
  QueryResult,
  RawQueryFragment,
  Transaction,
} from "@mikro-orm/core";
import {
  MikroORM as PostgreSqlMikroORM,
  PostgreSqlConnection,
  PostgreSqlPlatform,
} from "@mikro-orm/postgresql";
import { AbstractSqlDriver, type NativeQueryBuilder } from "@mikro-orm/sql";

import { RowLevelSecurityExecutor } from "./row-level-security-executor.js";

/** PostgreSQL connection that applies RLS role and context at SQL execution time. */
export class RowLevelSecurityConnection extends PostgreSqlConnection {
  private rlsExecutor?: RowLevelSecurityExecutor;

  /** Applies row level security setup before delegating SQL execution to MikroORM. */
  override async execute<
    T extends QueryResult | EntityData<AnyEntity> | EntityData<AnyEntity>[] =
      EntityData<AnyEntity>[],
  >(
    query: string | NativeQueryBuilder | RawQueryFragment,
    params: readonly unknown[] = [],
    method: "all" | "get" | "run" = "all",
    ctx?: Transaction,
    loggerContext?: LoggingOptions,
  ): Promise<T> {
    this.rlsExecutor ??= new RowLevelSecurityExecutor(
      this,
      super.execute.bind(this),
      true,
    );
    return await this.rlsExecutor.execute<T>(
      query,
      params,
      method,
      ctx,
      loggerContext,
    );
  }
}

/** MikroORM PostgreSQL driver that applies row level security per SQL query. */
export class RowLevelSecurityDriver extends AbstractSqlDriver<RowLevelSecurityConnection> {
  /** Creates a PostgreSQL driver using the row level security connection. */
  constructor(config: Configuration) {
    super(config, new PostgreSqlPlatform(), RowLevelSecurityConnection, [
      "knex",
      "pg",
    ]);
  }

  /** Exposes the PostgreSQL ORM token used by the MikroORM Nest integration. */
  override getORMClass() {
    return PostgreSqlMikroORM;
  }
}
