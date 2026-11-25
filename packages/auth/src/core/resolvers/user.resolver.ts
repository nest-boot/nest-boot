import { Args, Parent, ResolveField, Resolver } from "@nest-boot/graphql";
import { type ConnectionArgsInterface } from "@nest-boot/graphql-connection";

import { filterPermissionValues } from "../../common/utils/filter-permission-values.util.js";
import {
  AccountConnection,
  AccountConnectionArgs,
} from "../connections/account.connection-definition.js";
import {
  SessionConnection,
  SessionConnectionArgs,
} from "../connections/session.connection-definition.js";
import { type Account } from "../entities/account.entity.js";
import { type Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserPermission } from "../enums/user-permission.enum.js";
import { AccountService } from "../services/account.service.js";
import { SessionService } from "../services/session.service.js";

/** Self-service relations on authenticated users. */
@Resolver(() => User)
export class UserResolver {
  /**
   * Resolves grants supported by the current GraphQL permission catalog.
   * @param user - Identity or credential whose stored grants are being presented.
   * @returns Serializable permission values without mutating effective grants.
   */
  @ResolveField(() => [UserPermission])
  permissions(@Parent() user: User): UserPermission[] {
    return filterPermissionValues(user.permissions, UserPermission);
  }

  /**
   * Creates this resolver.
   * @param sessionService - Self-session queries.
   * @param accountService - Linked account queries.
   */
  constructor(
    private readonly sessionService: SessionService,
    private readonly accountService: AccountService,
  ) {}

  /**
   * Lists active sessions belonging to the parent user after service authorization.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @returns Paginated active sessions belonging to the user.
   */
  @ResolveField(() => SessionConnection)
  async sessions(
    @Parent() user: User,
    @Args({ type: () => SessionConnectionArgs })
    args: ConnectionArgsInterface<Session>,
  ) {
    return await this.sessionService.getSessionConnectionByUser(user, args);
  }

  /**
   * Paginates the parent's linked accounts after service authorization.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @returns Paginated linked accounts with credentials omitted.
   */
  @ResolveField(() => AccountConnection)
  async accounts(
    @Parent() user: User,
    @Args({ type: () => AccountConnectionArgs })
    args: ConnectionArgsInterface<Account>,
  ) {
    return await this.accountService.getAccountConnectionByUser(user, args);
  }
}
