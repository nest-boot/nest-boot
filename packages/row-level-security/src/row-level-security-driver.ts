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
const ROW_LEVEL_SECURITY_TRANSACTION_CONTEXT_KEYS = Symbol(
  "rowLevelSecurityTransactionContextKeys",
);
const ROW_LEVEL_SECURITY_TRANSACTION_QUEUE = Symbol(
  "rowLevelSecurityTransactionQueue",
);

interface RowLevelSecurityTransactionState {
  [ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE]?: string;
  [ROW_LEVEL_SECURITY_TRANSACTION_CONTEXT_KEYS]?: string[];
  [ROW_LEVEL_SECURITY_TRANSACTION_QUEUE]?: Promise<void>;
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
    const transactionContext = getTransactionContext(queryOrKnex, ctx);

    if (transactionContext) {
      const transaction = transactionContext as Transaction;

      return await this.runInTransactionQueue(transaction, async () => {
        await this.configureRowLevelSecurity(transaction, setup, loggerContext);

        return await super.execute(
          queryOrKnex,
          params,
          method,
          transaction,
          loggerContext,
        );
      });
    }

    if (!setup || setup.action === "clear") {
      return await super.execute(
        queryOrKnex,
        params,
        method,
        ctx,
        loggerContext,
      );
    }

    return await this.transactional(
      async (trx) => {
        return await this.runInTransactionQueue(trx, async () => {
          await this.configureRowLevelSecurity(trx, setup, loggerContext);

          return await super.execute(
            queryOrKnex,
            params,
            method,
            trx,
            loggerContext,
          );
        });
      },
      {
        loggerContext,
      },
    );
  }

  private async runInTransactionQueue<T>(
    ctx: Transaction,
    callback: () => Promise<T>,
  ) {
    const transactionState = ctx as RowLevelSecurityTransactionState;
    const previous = transactionState[ROW_LEVEL_SECURITY_TRANSACTION_QUEUE];
    let release: () => void = () => {
      return;
    };
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = (previous ?? Promise.resolve()).then(
      () => current,
      () => current,
    );

    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_QUEUE] = queued;
    await previous?.catch(() => undefined);

    try {
      return await callback();
    } finally {
      release();

      if (transactionState[ROW_LEVEL_SECURITY_TRANSACTION_QUEUE] === queued) {
        transactionState[ROW_LEVEL_SECURITY_TRANSACTION_QUEUE] = undefined;
      }
    }
  }

  private async configureRowLevelSecurity(
    ctx: Transaction,
    setup: RowLevelSecurityTransactionSetup | undefined,
    loggerContext?: LoggingOptions,
  ) {
    if (!setup) {
      return;
    }

    if (setup.action === "clear") {
      await this.clearRowLevelSecurity(ctx, loggerContext);
      return;
    }

    const transactionState = ctx as RowLevelSecurityTransactionState;
    const staleContextKeys = getStaleContextKeys(
      transactionState[ROW_LEVEL_SECURITY_TRANSACTION_CONTEXT_KEYS] ?? [],
      setup.contextKeys,
    );
    const setupSql = [setup.sql, createClearContextSql(staleContextKeys)]
      .filter(Boolean)
      .join("\n");

    if (
      transactionState[ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE] ===
        setup.signature &&
      staleContextKeys.length === 0
    ) {
      return;
    }

    await super.execute(setupSql, [], "run", ctx, loggerContext);
    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE] =
      setup.signature;
    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_CONTEXT_KEYS] = [
      ...setup.contextKeys,
    ];
  }

  private async clearRowLevelSecurity(
    ctx: Transaction,
    loggerContext?: LoggingOptions,
  ) {
    const transactionState = ctx as RowLevelSecurityTransactionState;
    const contextKeys =
      transactionState[ROW_LEVEL_SECURITY_TRANSACTION_CONTEXT_KEYS] ?? [];

    if (
      !transactionState[ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE] &&
      contextKeys.length === 0
    ) {
      return;
    }

    await super.execute(
      [/* SQL */ "SET LOCAL ROLE NONE;", createClearContextSql(contextKeys)]
        .filter(Boolean)
        .join("\n"),
      [],
      "run",
      ctx,
      loggerContext,
    );
    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE] = undefined;
    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_CONTEXT_KEYS] = [];
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

function getStaleContextKeys(previousKeys: string[], nextKeys: string[]) {
  const nextKeySet = new Set(nextKeys);

  return previousKeys.filter((key) => !nextKeySet.has(key));
}

function createClearContextSql(contextKeys: string[]) {
  if (contextKeys.length === 0) {
    return "";
  }

  return `SELECT ${contextKeys
    .map((key) => `set_config('app.${key}', '', true)`)
    .join(",")};`;
}
