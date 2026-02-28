import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, NestMiddleware, Optional } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

import { MODULE_OPTIONS_TOKEN } from "./request-transaction.module-definition";
import { RequestTransactionModuleOptions } from "./request-transaction-module-options.interface";

/**
 * Middleware that wraps each HTTP request in a database transaction.
 *
 * @remarks
 * Creates a child request context, starts a transaction, and waits for
 * the response to close before committing. If an error occurs, the
 * transaction is rolled back automatically by MikroORM.
 */
@Injectable()
export class RequestTransactionMiddleware implements NestMiddleware {
  /**
   * Creates a new RequestTransactionMiddleware instance.
   * @param em - MikroORM entity manager
   * @param options - Optional transaction configuration options
   */
  constructor(
    protected readonly em: EntityManager,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    protected readonly options?: RequestTransactionModuleOptions,
  ) {}

  /**
   * Wraps the request in a database transaction.
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next function
   */
  async use(req: Request, res: Response, next: NextFunction) {
    if (this.em.isInTransaction()) {
      next();
    } else {
      await RequestContext.child(async () => {
        await this.em.transactional(async (em) => {
          RequestContext.set(EntityManager, em);

          await new Promise<void>((resolve) => {
            const onResponseClose = () => {
              res.off("close", onResponseClose);
              resolve();
            };

            if (res.closed) {
              onResponseClose();
            } else {
              res.once("close", onResponseClose);
            }

            next();
          });
        }, this.options);
      });
    }
  }
}
