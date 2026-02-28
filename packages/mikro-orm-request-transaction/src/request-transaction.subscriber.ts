import {
  EventSubscriber,
  type Transaction,
  TransactionEventArgs,
} from "@mikro-orm/core";
import { Injectable, OnApplicationShutdown } from "@nestjs/common";

/**
 * Subscriber that tracks active database transactions and ensures cleanup on shutdown.
 *
 * @remarks
 * Monitors transaction lifecycle events and rolls back any active transactions
 * during application shutdown to prevent dangling connections.
 */
@Injectable()
export class RequestTransactionSubscriber
  implements EventSubscriber, OnApplicationShutdown
{
  /** Set of currently active database transactions. @internal */
  private readonly activeTransactions = new Set<Transaction>();

  /**
   * Records a transaction after it starts.
   * @param args - Transaction event arguments
   */
  afterTransactionStart(args: TransactionEventArgs) {
    if (args.transaction) {
      this.activeTransactions.add(args.transaction);
    }
  }

  /**
   * Removes a transaction from tracking after commit.
   * @param args - Transaction event arguments
   */
  afterTransactionCommit(args: TransactionEventArgs) {
    if (args.transaction) {
      this.activeTransactions.delete(args.transaction);
    }
  }

  /**
   * Removes a transaction from tracking after rollback.
   * @param args - Transaction event arguments
   */
  afterTransactionRollback(args: TransactionEventArgs) {
    if (args.transaction) {
      this.activeTransactions.delete(args.transaction);
    }
  }

  /** Rolls back all active transactions during application shutdown. */
  async onApplicationShutdown() {
    await Promise.allSettled(
      [...this.activeTransactions.values()].map((trx) => trx.rollback()),
    );
  }
}
