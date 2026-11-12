import {
  EntityManager,
  type EventSubscriber,
  TransactionContext,
  type TransactionEventArgs,
} from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { Injectable, type OnModuleInit } from "@nestjs/common";
interface PendingIdentity {
  parent?: object;
  changes: (() => void)[];
}
/** Publishes request changes only after their native transaction commits, including nested savepoints. */
@Injectable()
export class AuthTransactionSubscriber
  implements OnModuleInit, EventSubscriber
{
  private readonly transactions = new WeakMap<object, PendingIdentity>();
  private readonly parents = new WeakMap<EntityManager, object>();
  constructor(private readonly em: EntityManager) {}
  onModuleInit(): void {
    this.em.getEventManager().registerSubscriber(this);
  }
  beforeTransactionStart({ em, transaction }: TransactionEventArgs): void {
    if (transaction) {
      this.parents.set(em, transaction);
    } else {
      this.parents.delete(em);
    }
  }
  afterTransactionStart({ em, transaction }: TransactionEventArgs): void {
    if (!transaction) {
      return;
    }
    this.transactions.set(transaction, {
      parent: this.parents.get(em),
      changes: [],
    });
    this.parents.delete(em);
  }
  afterTransactionCommit({ em, transaction }: TransactionEventArgs): void {
    if (!transaction) {
      return;
    }
    const pending = this.transactions.get(transaction);
    this.transactions.delete(transaction);
    if (!pending) {
      return;
    }
    if (pending.parent) {
      const parent = this.transactions.get(pending.parent);
      if (parent) {
        parent.changes.push(...pending.changes);
      }
      return;
    }
    if (!pending.changes.length) {
      return;
    }
    // The connection has committed; allow the request's next SQL statement to adopt its new RLS scope.
    em.resetTransactionContext();
    for (const apply of pending.changes) {
      apply();
    }
  }
  afterTransactionRollback({ transaction }: TransactionEventArgs): void {
    if (transaction) {
      this.transactions.delete(transaction);
    }
  }
  afterCommit(apply: () => void): void {
    if (!RequestContext.isActive()) {
      return;
    }
    const transaction = (
      TransactionContext.getEntityManager(this.em.name) ?? this.em
    ).getTransactionContext();
    if (!transaction) {
      apply();
      return;
    }
    const pending = this.transactions.get(transaction);
    if (!pending) {
      throw new Error(
        "AuthContext must be initialized before starting a transaction",
      );
    }
    const origin = RequestContext.current();
    pending.changes.push(() => {
      if (RequestContext.isActive() && RequestContext.current() === origin) {
        apply();
      }
    });
  }
}
