import { EntityManager } from "@mikro-orm/core";
import { Knex } from "@mikro-orm/postgresql";
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Request, Response } from "express";
import { concatMap, from, Observable } from "rxjs";

import { AuthTransactionContext } from "./auth.transaction-context";
import { BaseSession, BaseUser } from "./entities";

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  constructor(protected readonly em: EntityManager) {}

  async getRequest(context: ExecutionContext): Promise<Request> {
    if (context.getType<"graphql">() === "graphql") {
      return context.getArgByIndex(2).req;
    }

    return await context.switchToHttp().getRequest();
  }

  async getResponse(context: ExecutionContext): Promise<Response> {
    if (context.getType<"graphql">() === "graphql") {
      return context.getArgByIndex(2).req.res;
    }

    return await context.switchToHttp().getResponse();
  }

  /**
   * 扩展事务上下文
   * 子类可以重写此方法来添加自定义的上下文信息
   */
  extendTransactionContext(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    transactionContext: AuthTransactionContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    executionContext: ExecutionContext,
  ): void | Promise<void> {
    //
  }

  private async setTransactionAuthContext(
    executionContext: ExecutionContext,
    knex?: Knex,
  ): Promise<void> {
    if (!knex) {
      throw new Error("Knex is not found in transaction context");
    }

    const res = await this.getResponse(executionContext);

    const user: BaseUser | undefined = res.locals.user;
    const session: BaseSession | undefined = res.locals.session;

    if (user && session) {
      const transactionContext = new AuthTransactionContext()
        .set("user_id", user.id)
        .set("user_name", user.name)
        .set("user_email", user.email)
        .set("session_id", session.id)
        .set("session_token", session.token)
        .set("session_expires_at", session.expiresAt.toISOString())
        .set("session_ip_address", session.ipAddress ?? "")
        .set("session_user_agent", session.userAgent ?? "");

      await this.extendTransactionContext(transactionContext, executionContext);

      await knex.raw(
        [
          /* SQL */ `SET LOCAL ROLE authenticated;`,
          transactionContext.toSQL(),
        ].join("\n"),
      );
    } else {
      await knex.raw(/* SQL */ `SET LOCAL ROLE anonymous;`);
    }
  }

  private async interceptAsync(
    executionContext: ExecutionContext,
  ): Promise<void> {
    // 检查是否已在事务中
    const knex = this.em.getTransactionContext<Knex>();

    if (knex) {
      // 已在事务中,直接设置认证上下文
      await this.setTransactionAuthContext(executionContext, knex);
    } else {
      // 不在事务中,启动一个新事务
      await this.em.transactional(async (em) => {
        await this.setTransactionAuthContext(
          executionContext,
          em.getTransactionContext<Knex>(),
        );
      });
    }
  }

  intercept<T>(
    executionContext: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T> {
    if (["http", "graphql"].includes(executionContext.getType())) {
      return from(this.interceptAsync(executionContext)).pipe(
        concatMap(() => next.handle()),
      );
    }

    return next.handle();
  }
}
