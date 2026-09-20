import { EntityManager } from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  type ConnectionInterface,
  ConnectionManager,
} from "@nest-boot/graphql-connection";
import { ForbiddenException, Injectable } from "@nestjs/common";

import { AccountConnection } from "../connections/account.connection-definition.js";
import { type Account } from "../entities/account.entity.js";
import { type User } from "../entities/user.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";

/** Safe account queries scoped to the current user session and application RLS. */
@Injectable()
export class AccountService {
  /** Creates the account query service. */
  constructor(private readonly em: EntityManager) {}

  /** Paginates the current session user's accounts without loading credentials. */
  async getAccountConnectionByUser(
    user: User,
    args: ConnectionArgsInterface<Account>,
  ): Promise<ConnectionInterface<Account>> {
    RequestIdentity.assertCurrentUser(user);
    if (getCurrentApiKey()) {
      throw new ForbiddenException(
        "Account inspection requires a user session",
      );
    }
    return await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<Account>(AccountConnection, args, {
      where: { user: String(user.id) },
      exclude: ["password", "accessToken", "refreshToken", "idToken"] as never,
    });
  }
}
