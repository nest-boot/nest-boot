import type {
  AnyEntity,
  EntityData,
  LoggingOptions,
  QueryResult,
  RawQueryFragment,
  Transaction,
} from "@mikro-orm/core";
import type { AbstractSqlConnection, NativeQueryBuilder } from "@mikro-orm/sql";

import {
  createRowLevelSecurityTransactionSetup,
  RowLevelSecurityTransactionSetup,
} from "./utils/create-row-level-security-transaction-setup.js";

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

interface RowLevelSecurityTransactionContext {
  state: RowLevelSecurityTransactionState;
  execution: Transaction;
}

/** Shared query interception for PostgreSQL-compatible RLS connections. @internal */
export class RowLevelSecurityExecutor {
  constructor(
    private readonly connection: Pick<AbstractSqlConnection, "transactional">,
    private readonly executeQuery: AbstractSqlConnection["execute"],
    private readonly supportsMultipleStatements: boolean,
  ) {}

  /** Applies row level security setup before delegating SQL execution to MikroORM. */
  async execute<
    T extends QueryResult | EntityData<AnyEntity> | EntityData<AnyEntity>[] =
      EntityData<AnyEntity>[],
  >(
    queryOrKnex: string | NativeQueryBuilder | RawQueryFragment,
    params: readonly unknown[] = [],
    method: "all" | "get" | "run" = "all",
    ctx?: Transaction,
    loggerContext?: LoggingOptions,
  ): Promise<T> {
    const setup = createRowLevelSecurityTransactionSetup();
    const transactionContext = getTransactionContext(queryOrKnex, ctx);

    if (transactionContext) {
      return await this.runInTransactionQueue(
        transactionContext.state,
        async () => {
          await this.configureRowLevelSecurity(
            transactionContext.state,
            transactionContext.execution,
            setup,
            loggerContext,
          );

          return await this.executeQuery(
            queryOrKnex,
            params,
            method,
            transactionContext.execution,
            loggerContext,
          );
        },
      );
    }

    if (!setup || setup.action === "clear") {
      return await this.executeQuery(
        queryOrKnex,
        params,
        method,
        ctx,
        loggerContext,
      );
    }

    return await this.connection.transactional(
      async (trx) => {
        const transactionState = trx as RowLevelSecurityTransactionState;

        return await this.runInTransactionQueue(transactionState, async () => {
          await this.configureRowLevelSecurity(
            transactionState,
            trx,
            setup,
            loggerContext,
          );

          return await this.executeQuery(
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
    transactionState: RowLevelSecurityTransactionState,
    callback: () => Promise<T>,
  ) {
    const previous = transactionState[ROW_LEVEL_SECURITY_TRANSACTION_QUEUE];
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Queue entries are completion barriers, not query results. They always
    // resolve in finally, including when setup or query execution fails.
    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_QUEUE] = current;
    await previous;

    try {
      return await callback();
    } finally {
      release();

      if (transactionState[ROW_LEVEL_SECURITY_TRANSACTION_QUEUE] === current) {
        transactionState[ROW_LEVEL_SECURITY_TRANSACTION_QUEUE] = undefined;
      }
    }
  }

  private async configureRowLevelSecurity(
    transactionState: RowLevelSecurityTransactionState,
    ctx: Transaction,
    setup: RowLevelSecurityTransactionSetup | undefined,
    loggerContext?: LoggingOptions,
  ) {
    if (!setup) {
      await this.clearRowLevelSecurity(transactionState, ctx, loggerContext);
      return;
    }

    if (setup.action === "clear") {
      await this.clearRowLevelSecurity(transactionState, ctx, loggerContext);
      return;
    }

    const staleContextKeys = getStaleContextKeys(
      transactionState[ROW_LEVEL_SECURITY_TRANSACTION_CONTEXT_KEYS] ?? [],
      setup.contextKeys,
    );
    const setupSql = [
      ...setup.statements,
      createClearContextSql(staleContextKeys),
    ];

    if (
      transactionState[ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE] ===
        setup.signature &&
      staleContextKeys.length === 0
    ) {
      return;
    }

    await this.executeSetup(setupSql, ctx, loggerContext);
    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE] =
      setup.signature;
    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_CONTEXT_KEYS] = [
      ...setup.contextKeys,
    ];
  }

  private async clearRowLevelSecurity(
    transactionState: RowLevelSecurityTransactionState,
    ctx: Transaction,
    loggerContext?: LoggingOptions,
  ) {
    const contextKeys =
      transactionState[ROW_LEVEL_SECURITY_TRANSACTION_CONTEXT_KEYS] ?? [];

    if (
      !transactionState[ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE] &&
      contextKeys.length === 0
    ) {
      return;
    }

    await this.executeSetup(
      [/* SQL */ "SET LOCAL ROLE NONE;", createClearContextSql(contextKeys)],
      ctx,
      loggerContext,
    );
    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_SIGNATURE] = undefined;
    transactionState[ROW_LEVEL_SECURITY_TRANSACTION_CONTEXT_KEYS] = [];
  }

  private async executeSetup(
    statements: string[],
    ctx: Transaction,
    loggerContext?: LoggingOptions,
  ) {
    const queries = statements.filter(Boolean);
    // PGlite uses the extended query protocol. Preserve statement boundaries
    // from the builder instead of splitting SQL literals on semicolons.
    for (const sql of this.supportsMultipleStatements
      ? [queries.join("\n")]
      : queries) {
      await this.executeQuery(sql, [], "run", ctx, loggerContext);
    }
  }
}

function getTransactionContext(
  queryOrKnex: unknown,
  ctx: unknown,
): RowLevelSecurityTransactionContext | undefined {
  if (ctx) {
    return {
      state: ctx as RowLevelSecurityTransactionState,
      execution: ctx as Transaction,
    };
  }

  if (typeof queryOrKnex === "string") {
    return undefined;
  }

  return undefined;
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
    .map((key) => `set_config('app.${key}', null, true)`)
    .join(",")};`;
}
