import { Args, Parent, ResolveField, Resolver } from "@nest-boot/graphql";
import { type ConnectionArgsInterface } from "@nest-boot/graphql-connection";

import { User } from "../../core/entities/user.entity.js";
import {
  WorkspaceConnection,
  WorkspaceConnectionArgs,
} from "../connections/workspace.connection-definition.js";
import {
  WorkspaceInvitationConnection,
  WorkspaceInvitationConnectionArgs,
} from "../connections/workspace-invitation.connection-definition.js";
import type { Workspace } from "../entities/workspace.entity.js";
import type { WorkspaceInvitation } from "../entities/workspace-invitation.entity.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { WorkspaceInvitationService } from "../services/workspace-invitation.service.js";

/** User relations available only when workspace features are enabled. */
@Resolver(() => User)
export class UserWorkspaceResolver {
  /**
   * Creates the workspace relations resolver.
   * @param workspaceService - Workspace queries.
   * @param workspaceInvitationService - WorkspaceInvitation queries.
   */
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceInvitationService: WorkspaceInvitationService,
  ) {}

  /**
   * Paginates workspaces joined by the parent user.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @returns Paginated workspaces accessible to the user.
   */
  @ResolveField(() => WorkspaceConnection)
  async workspaces(
    @Parent() user: User,
    @Args({ type: () => WorkspaceConnectionArgs })
    args: ConnectionArgsInterface<Workspace>,
  ) {
    return await this.workspaceService.getWorkspaceConnectionByUser(user, args);
  }

  /**
   * Paginates pending invitations addressed to the parent user.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @returns Paginated invitations visible to the current principal.
   */
  @ResolveField(() => WorkspaceInvitationConnection)
  async invitations(
    @Parent() user: User,
    @Args({ type: () => WorkspaceInvitationConnectionArgs })
    args: ConnectionArgsInterface<WorkspaceInvitation>,
  ) {
    return await this.workspaceInvitationService.getWorkspaceInvitationConnectionByUser(
      user,
      args,
    );
  }
}
