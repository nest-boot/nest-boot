import {
  EventSubscriber,
  type Transaction,
  TransactionEventArgs,
} from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ActiveTransactionManager implements EventSubscriber {
  private readonly activeTransactions = new Set<Transaction>();

  afterTransactionStart(args: TransactionEventArgs) {
    if (args.transaction) {
      this.activeTransactions.add(args.transaction);
    }
  }

  afterTransactionCommit(args: TransactionEventArgs) {
    if (args.transaction) {
      this.activeTransactions.delete(args.transaction);
    }
  }

  afterTransactionRollback(args: TransactionEventArgs) {
    if (args.transaction) {
      this.activeTransactions.delete(args.transaction);
    }
  }

  async rollbackActiveTransactions() {
    await Promise.allSettled(
      [...this.activeTransactions.values()].map((trx) => trx.rollback()),
    );
  }
}
