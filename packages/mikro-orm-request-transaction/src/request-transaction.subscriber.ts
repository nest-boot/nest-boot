import {
  EventSubscriber,
  type Transaction,
  TransactionEventArgs,
} from "@mikro-orm/core";
import { Injectable, OnApplicationShutdown } from "@nestjs/common";

/**
 * Subscriber to track active transactions.
 * Ensures that all active transactions are rolled back on application shutdown.
 */
@Injectable()
export class RequestTransactionSubscriber
  implements EventSubscriber, OnApplicationShutdown
{
  private readonly activeTransactions = new Set<Transaction>();

  /**
   * Called after a transaction starts.
   */
  afterTransactionStart(args: TransactionEventArgs) {
    if (args.transaction) {
      this.activeTransactions.add(args.transaction);
    }
  }

  /**
   * Called after a transaction is committed.
   */
  afterTransactionCommit(args: TransactionEventArgs) {
    if (args.transaction) {
      this.activeTransactions.delete(args.transaction);
    }
  }

  /**
   * Called after a transaction is rolled back.
   */
  afterTransactionRollback(args: TransactionEventArgs) {
    if (args.transaction) {
      this.activeTransactions.delete(args.transaction);
    }
  }

  /**
   * Called when the application shuts down.
   * Rolls back all active transactions to prevent hanging connections or locks.
   */
  async onApplicationShutdown() {
    await Promise.allSettled(
      [...this.activeTransactions.values()].map((trx) => trx.rollback()),
    );
  }
}
