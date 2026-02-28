import { EntityManager } from "@mikro-orm/core";
import { Knex } from "@mikro-orm/postgresql";
import { BaseUser } from "@nest-boot/auth";
import { Inject, Injectable, Optional } from "@nestjs/common";

import { AuthRlsContext } from "./auth-rls.context";
import { MODULE_OPTIONS_TOKEN } from "./auth-rls.module-definition";
import { AuthRlsModuleOptions } from "./auth-rls-module-options.interface";

/**
 * Service that applies PostgreSQL row-level security context within a database transaction.
 *
 * @remarks
 * Sets the PostgreSQL role to `authenticated` or `anonymous` and populates
 * transaction-local config variables (`auth.user_id`, `auth.user_name`, etc.)
 * based on the current user.
 */
@Injectable()
export class AuthRlsService {
  /** Creates a new AuthRlsService instance.
   * @param options - Optional RLS module configuration
   */
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    protected readonly options?: AuthRlsModuleOptions,
  ) {}

  /**
   * Applies RLS context to the current database transaction.
   * @param em - The MikroORM entity manager (must have an active transaction)
   * @param user - The authenticated user, or `undefined` for anonymous access
   */
  async setRlsContext(em: EntityManager, user?: BaseUser): Promise<void> {
    const knex = em.getTransactionContext<Knex>();

    if (!knex) {
      throw new Error(
        "Transaction context is not available. Ensure you are calling this method within a transaction.",
      );
    }

    if (user) {
      let ctx = new AuthRlsContext()
        .set("user_id", user.id)
        .set("user_name", user.name)
        .set("user_email", user.email);

      if (this.options?.context) {
        ctx = await this.options.context(ctx);
      }

      await knex.raw(
        [/* SQL */ `SET LOCAL ROLE authenticated;`, ctx.toSQL()].join("\n"),
      );
    } else {
      await knex.raw(/* SQL */ `SET LOCAL ROLE anonymous;`);
    }
  }
}
