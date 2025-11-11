import { EntityManager } from "@mikro-orm/core";
import { Knex } from "@mikro-orm/postgresql";
import { BaseSession, BaseUser } from "@nest-boot/auth";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NestMiddleware,
  Optional,
} from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

import { AuthRlsContext } from "./auth-rls.context";
import { MODULE_OPTIONS_TOKEN } from "./auth-rls.module-definition";
import { AuthRlsModuleOptions } from "./auth-rls-module-options.interface";

@Injectable()
export class AuthRlsMiddleware implements NestMiddleware {
  constructor(
    protected readonly em: EntityManager,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    protected readonly options?: AuthRlsModuleOptions,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const knex = this.em.getTransactionContext<Knex>();

    if (!knex) {
      throw new HttpException(
        "Transaction context is not available. Ensure RequestTransactionMiddleware is registered before AuthRlsMiddleware.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const user: BaseUser | undefined = res.locals.user;
    const session: BaseSession | undefined = res.locals.session;

    if (user && session) {
      let ctx = new AuthRlsContext()
        .set("user_id", user.id)
        .set("user_name", user.name)
        .set("user_email", user.email)
        .set("session_id", session.id)
        .set("session_token", session.token)
        .set("session_expires_at", session.expiresAt.toISOString())
        .set("session_ip_address", session.ipAddress ?? "")
        .set("session_user_agent", session.userAgent ?? "");

      if (this.options?.context) {
        ctx = await this.options.context(ctx, req, res);
      }

      await knex.raw(
        [/* SQL */ `SET LOCAL ROLE authenticated;`, ctx.toSQL()].join("\n"),
      );
    } else {
      await knex.raw(/* SQL */ `SET LOCAL ROLE anonymous;`);
    }

    next();
  }
}
