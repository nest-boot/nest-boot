/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRuntimeContext, RuntimeContext } from "@nest-boot/common";
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, of } from "rxjs";
import { retryWhen, take, tap } from "rxjs/operators";
import { QueryRunner } from "typeorm";
import { TransactionAlreadyStartedError } from "typeorm/error/TransactionAlreadyStartedError";

import {
  TRANSACTION_MODE_METADATA_KEY,
  TransactionMode,
} from "../decorators/transaction.decorator";
import { TransactionalConnection } from "../services/transactional-connection";

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    private connection: TransactionalConnection,
    private reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = getRuntimeContext();

    if (ctx) {
      const transactionMode = this.reflector.get<TransactionMode>(
        TRANSACTION_MODE_METADATA_KEY,
        context.getHandler()
      );
      return of(
        this.withTransaction(ctx, () => next.handle(), transactionMode)
      );
    }
    return next.handle();
  }

  private isRetriableError(err: any): boolean {
    const mysqlDeadlock = err.code === "ER_LOCK_DEADLOCK";
    const postgresDeadlock = err.code === "deadlock_detected";
    return mysqlDeadlock || postgresDeadlock;
  }

  private async startTransaction(queryRunner: QueryRunner) {
    const maxRetries = 25;
    let attempts = 0;
    let lastError: any;
    // Returns false if a transaction is already in progress
    async function attemptStartTransaction(): Promise<boolean> {
      try {
        await queryRunner.startTransaction();
        return true;
      } catch (err) {
        lastError = err;
        if (err instanceof TransactionAlreadyStartedError) {
          return false;
        }
        throw err;
      }
    }
    while (attempts < maxRetries) {
      // eslint-disable-next-line no-await-in-loop
      const result = await attemptStartTransaction();

      if (result) {
        return;
      }

      // eslint-disable-next-line no-plusplus
      attempts++;

      // insert an increasing delay before retrying
      // eslint-disable-next-line no-await-in-loop, no-loop-func
      await new Promise((resolve) => {
        setTimeout(resolve, attempts * 20);
      });
    }
    throw lastError;
  }

  private async withTransaction<T>(
    ctx: RuntimeContext,
    work: () => Observable<T>,
    mode: TransactionMode
  ): Promise<T> {
    const queryRunnerExists = !!ctx.transactionQueryRunner;

    if (queryRunnerExists) {
      // If a QueryRunner already exists on the RequestContext, there must be an existing
      // outer transaction in progress. In that case, we just execute the work function
      // as usual without needing to further wrap in a transaction.
      return await work().toPromise();
    }

    const queryRunner = this.connection.rawConnection.createQueryRunner();

    if (mode === "auto") {
      await this.startTransaction(queryRunner);
    }

    ctx.transactionQueryRunner = queryRunner;

    try {
      const maxRetries = 5;
      const result = await work()
        .pipe(
          retryWhen((errors) =>
            errors.pipe(
              tap((err) => {
                if (!this.isRetriableError(err)) {
                  throw err;
                }
              }),
              take(maxRetries)
            )
          )
        )
        .toPromise();
      if (queryRunner.isTransactionActive) {
        await queryRunner.commitTransaction();
      }
      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (queryRunner?.isReleased === false) {
        await queryRunner.release();
      }
    }
  }
}
