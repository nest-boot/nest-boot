import type {
  AnyEntity,
  Configuration,
  EntityData,
  LoggingOptions,
  QueryResult,
  Transaction,
} from "@mikro-orm/core";
import {
  AbstractSqlDriver,
  Knex,
  PostgreSqlConnection,
  PostgreSqlPlatform,
} from "@mikro-orm/postgresql";

import {
  createRowLevelSecurityTransactionSetup,
  RowLevelSecurityTransactionSetup,
} from "./utils/create-row-level-security-transaction-setup";

const ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE = Symbol(
  "rowLevelSecurityTransactionSignature",
);

interface RowLevelSecurityTransactionState {
  [ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE]?: string;
}

/** PostgreSQL connection that applies RLS role and context at SQL execution time. */
export class RowLevelSecurityConnection extends PostgreSqlConnection {
  /** Applies row level security setup before delegating SQL execution to MikroORM. */
  override async execute<
    T extends QueryResult | EntityData<AnyEntity> | EntityData<AnyEntity>[] =
      EntityData<AnyEntity>[],
  >(
    queryOrKnex: string | Knex.QueryBuilder | Knex.Raw,
    params: unknown[] = [],
    method: "all" | "get" | "run" = "all",
    ctx?: Transaction,
    loggerContext?: LoggingOptions,
  ): Promise<T> {
    const setup = createRowLevelSecurityTransactionSetup();

    if (!setup) {
      return await super.execute(
        queryOrKnex,
        params,
        method,
        ctx,
        loggerContext,
      );
    }

    const transactionContext = getTransactionContext(queryOrKnex, ctx);

    if (transactionContext) {
      const transaction = transactionContext as Transaction;

      await this.applyRowLevelSecurity(transaction, setup, loggerContext);
      return await super.execute(
        queryOrKnex,
        params,
        method,
        transaction,
        loggerContext,
      );
    }

    return await this.transactional(
      async (trx) => {
        await this.applyRowLevelSecurity(trx, setup, loggerContext);
        return await super.execute(
          queryOrKnex,
          params,
          method,
          trx,
          loggerContext,
        );
      },
      {
        loggerContext,
      },
    );
  }

  private async applyRowLevelSecurity(
    ctx: Transaction,
    setup: RowLevelSecurityTransactionSetup,
    loggerContext?: LoggingOptions,
  ) {
    const transactionState = ctx as RowLevelSecurityTransactionState;

    if (
      transactionState[ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE] ===
      setup.signature
    ) {
      return;
    }

    await super.execute(setup.sql, [], "run", ctx, loggerContext);
    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE] =
      setup.signature;
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
}

function getTransactionContext(queryOrKnex: unknown, ctx: unknown) {
  if (ctx || typeof queryOrKnex === "string") {
    return ctx;
  }

  const knexQuery = queryOrKnex as {
    client?: {
      transacting?: boolean;
    };
  };

  return knexQuery.client?.transacting ? queryOrKnex : ctx;
}
