import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, NestMiddleware, Optional } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

import { MODULE_OPTIONS_TOKEN } from "./request-transaction.module-definition";
import { RequestTransactionModuleOptions } from "./request-transaction-module-options.interface";

/**
 * Middleware that wraps the request in a database transaction.
 * It uses RequestContext.child() to create a new context for the transaction.
 * The transaction is committed when the response is closed, or rolled back if an error occurs (handled by MikroORM).
 */
@Injectable()
export class RequestTransactionMiddleware implements NestMiddleware {
  constructor(
    protected readonly em: EntityManager,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    protected readonly options?: RequestTransactionModuleOptions,
  ) {}

  /**
   * Middleware handler.
   * Starts a transaction and updates the RequestContext with the transactional EntityManager.
   *
   * @param req - The express request object.
   * @param res - The express response object.
   * @param next - The next function in the middleware chain.
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
