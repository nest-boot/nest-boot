import { EntityManager } from "@mikro-orm/core";
import { Knex } from "@mikro-orm/postgresql";
import { BaseUser } from "@nest-boot/auth";
import { Inject, Injectable, Optional } from "@nestjs/common";

import { AuthRlsContext } from "./auth-rls.context";
import { MODULE_OPTIONS_TOKEN } from "./auth-rls.module-definition";
import { AuthRlsModuleOptions } from "./auth-rls-module-options.interface";

/**
 * Service to manage Row Level Security (RLS) context in the database transaction.
 */
@Injectable()
export class AuthRlsService {
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    protected readonly options?: AuthRlsModuleOptions,
  ) {}

  /**
   * Sets the RLS context for the current transaction.
   * If a user is provided, it sets the role to 'authenticated' and sets user details in the context.
   * Otherwise, it sets the role to 'anonymous'.
   *
   * @param em - The MikroORM EntityManager.
   * @param user - The authenticated user (optional).
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
