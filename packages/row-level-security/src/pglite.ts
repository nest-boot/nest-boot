import {
  type AnyEntity,
  type Configuration,
  type EntityData,
  EntityManagerType,
  type LoggingOptions,
  type QueryResult,
  type RawQueryFragment,
  type Transaction,
} from "@mikro-orm/core";
import {
  MikroORM as PgliteMikroORM,
  PgliteConnection,
  PglitePlatform,
} from "@mikro-orm/pglite";
import {
  AbstractSqlDriver,
  BasePostgreSqlEntityManager,
  type NativeQueryBuilder,
} from "@mikro-orm/sql";

import { RowLevelSecurityExecutor } from "./row-level-security-executor.js";

/** PGlite connection that applies transaction-local RLS roles and context. */
export class PgliteRowLevelSecurityConnection extends PgliteConnection {
  private rlsExecutor?: RowLevelSecurityExecutor;

  /** Applies RLS setup before executing SQL through PGlite. */
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
      false,
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

/** MikroORM PGlite driver with the same request-scoped RLS behavior as PostgreSQL. */
export class PgliteRowLevelSecurityDriver extends AbstractSqlDriver<PgliteRowLevelSecurityConnection> {
  /** Entity manager type exposed to MikroORM's driver inference. */
  declare [EntityManagerType]: BasePostgreSqlEntityManager<this>;

  /** Creates a PGlite driver using the shared row-level security execution path. */
  constructor(config: Configuration) {
    super(config, new PglitePlatform(), PgliteRowLevelSecurityConnection, [
      "kysely",
      "@electric-sql/pglite",
    ]);
  }

  /** Preserves the PostgreSQL entity manager provided by MikroORM's PGlite driver. */
  override createEntityManager(
    useContext?: boolean,
  ): this[typeof EntityManagerType] {
    const EntityManagerClass = this.config.get(
      "entityManager",
      BasePostgreSqlEntityManager,
    );
    return new EntityManagerClass(this.config, this, this.metadata, useContext);
  }

  /** Exposes the PGlite ORM token used by the MikroORM Nest integration. */
  override getORMClass() {
    return PgliteMikroORM;
  }
}
