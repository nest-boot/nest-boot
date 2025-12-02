import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, NestMiddleware, Optional } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

import { MODULE_OPTIONS_TOKEN } from "./request-transaction.module-definition";
import { RequestTransactionModuleOptions } from "./request-transaction-module-options.interface";

@Injectable()
export class RequestTransactionMiddleware implements NestMiddleware {
  constructor(
    protected readonly em: EntityManager,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    protected readonly options?: RequestTransactionModuleOptions,
  ) {}

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
