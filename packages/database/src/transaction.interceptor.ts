import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { from, lastValueFrom, Observable } from "rxjs";

import { TRANSACTION_METADATA_KEY } from "./database.constants";
import { MODULE_OPTIONS_TOKEN } from "./database.module-definition";
import type { DatabaseModuleOptions } from "./interfaces";
import { TransactionOptions } from "./interfaces/transaction-options.interface";

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  private readonly transactionOptions: TransactionOptions;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: DatabaseModuleOptions,
    private readonly em: EntityManager,
    private readonly reflector: Reflector,
  ) {
    this.transactionOptions = this.options.transaction ?? false;
  }

  intercept<T>(
    executionContext: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T> {
    const transactionOptions =
      this.reflector.get<TransactionOptions>(
        TRANSACTION_METADATA_KEY,
        executionContext.getHandler(),
      ) ??
      this.reflector.get<TransactionOptions>(
        TRANSACTION_METADATA_KEY,
        executionContext.getClass(),
      ) ??
      this.transactionOptions;

    if (transactionOptions) {
      return from(
        this.em.transactional(
          async (em) => {
            RequestContext.set(EntityManager, em);
            return await lastValueFrom(next.handle());
          },
          transactionOptions === true ? {} : transactionOptions,
        ),
      );
    }

    return next.handle();
  }
}
