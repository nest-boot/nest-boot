import { Args, Info, Parent, ResolveField, Resolver } from "@nest-boot/graphql";
import type { ConnectionArgsInterface } from "@nest-boot/graphql-connection";
import type { GraphQLResolveInfo } from "graphql";

import { User } from "../../core/entities/user.entity.js";
import {
  InvitationConnection,
  InvitationConnectionArgs,
} from "../connections/invitation.connection-definition.js";
import {
  WorkspaceConnection,
  WorkspaceConnectionArgs,
} from "../connections/workspace.connection-definition.js";
import type { Invitation } from "../entities/invitation.entity.js";
import type { Workspace } from "../entities/workspace.entity.js";
import { InvitationService } from "../services/invitation.service.js";
import { WorkspaceService } from "../services/workspace.service.js";

/** User relations available only when workspace features are enabled. */
@Resolver(() => User)
export class UserWorkspaceResolver {
  /**
   * Creates the workspace relations resolver.
   * @param workspaceService - Workspace queries.
   * @param invitationService - Invitation queries.
   */
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly invitationService: InvitationService,
  ) {}

  /**
   * Paginates workspaces joined by the parent user.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated workspaces accessible to the user.
   */
  @ResolveField(() => WorkspaceConnection)
  async workspaces(
    @Parent() user: User,
    @Args({ type: () => WorkspaceConnectionArgs })
    args: ConnectionArgsInterface<Workspace>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.workspaceService.getWorkspaceConnectionByUser(
      user,
      args,
      info,
    );
  }

  /**
   * Paginates pending invitations addressed to the parent user.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated invitations visible to the current principal.
   */
  @ResolveField(() => InvitationConnection)
  async invitations(
    @Parent() user: User,
    @Args({ type: () => InvitationConnectionArgs })
    args: ConnectionArgsInterface<Invitation>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.invitationService.getInvitationConnectionByUser(
      user,
      args,
      info,
    );
  }
}
