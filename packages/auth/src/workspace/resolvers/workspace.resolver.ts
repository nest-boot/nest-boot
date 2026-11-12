import {
  Args,
  ID,
  Info,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import { type ConnectionArgsInterface } from "@nest-boot/graphql-connection";
import { type GraphQLResolveInfo } from "graphql";

import { CurrentUser } from "../../core/decorators/current-user.decorator.js";
import { User } from "../../core/entities/user.entity.js";
import {
  WorkspaceConnection,
  WorkspaceConnectionArgs,
} from "../connections/workspace.connection-definition.js";
import {
  WorkspaceInvitationConnection,
  WorkspaceInvitationConnectionArgs,
} from "../connections/workspace-invitation.connection-definition.js";
import {
  WorkspaceMemberConnection,
  WorkspaceMemberConnectionArgs,
} from "../connections/workspace-member.connection-definition.js";
import { CurrentWorkspaceMember } from "../decorators/current-workspace-member.decorator.js";
import { Workspace } from "../entities/workspace.entity.js";
import { type WorkspaceInvitation } from "../entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";
import { CreateWorkspaceInput } from "../inputs/create-workspace.input.js";
import { UpdateWorkspaceInput } from "../inputs/update-workspace.input.js";
import { CreateWorkspacePayload } from "../objects/create-workspace-payload.object.js";
import { DeleteWorkspacePayload } from "../objects/delete-workspace-payload.object.js";
import { LeaveWorkspacePayload } from "../objects/leave-workspace-payload.object.js";
import { UpdateWorkspacePayload } from "../objects/update-workspace-payload.object.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { WorkspaceInvitationService } from "../services/workspace-invitation.service.js";
import { WorkspaceMemberService } from "../services/workspace-member.service.js";

/** Workspace and membership API. */
@Resolver(() => Workspace)
export class WorkspaceResolver {
  /**
   * Creates this resolver.
   * @param workspaceService - Workspace lifecycle.
   * @param workspaceMemberService - Workspace memberships.
   * @param workspaceInvitationService - Workspace invitations.
   */
  constructor(
    readonly workspaceService: WorkspaceService,
    readonly workspaceMemberService: WorkspaceMemberService,
    readonly workspaceInvitationService: WorkspaceInvitationService,
  ) {}

  /**
   * Paginates members of the parent workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated members visible in the workspace.
   */
  @ResolveField(() => WorkspaceMemberConnection)
  async members(
    @Parent() workspace: Workspace,
    @Args({ type: () => WorkspaceMemberConnectionArgs })
    args: ConnectionArgsInterface<WorkspaceMember>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.workspaceMemberService.getWorkspaceMemberConnectionByWorkspace(
      workspace,
      args,
      info,
    );
  }

  /**
   * Paginates workspace invitations with authorization and querying handled by the service.
   * @param workspace - The workspace that scopes this operation.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated invitations visible to the current principal.
   */
  @ResolveField(() => WorkspaceInvitationConnection)
  async invitations(
    @Parent() workspace: Workspace,
    @Args({ type: () => WorkspaceInvitationConnectionArgs })
    args: ConnectionArgsInterface<WorkspaceInvitation>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.workspaceInvitationService.getWorkspaceInvitationConnectionByWorkspace(
      workspace,
      args,
      info,
    );
  }

  /**
   * Lists workspaces through the explicit platform administration boundary.
   * @param args - Cursor pagination, ordering and filtering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Page of workspaces authorized for platform access.
   */
  @Query(() => WorkspaceConnection)
  workspaces(
    @Args({ type: () => WorkspaceConnectionArgs })
    args: ConnectionArgsInterface<Workspace>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return this.workspaceService.getPlatformWorkspaceConnection(args, info);
  }

  /**
   * Reads any workspace only with a platform read permission.
   * @param id - Identifier of the target record.
   * @returns Authorized workspace, or null when it is unavailable.
   */
  @Query(() => Workspace, { nullable: true })
  platformWorkspace(@Args("id", { type: () => ID }) id: string) {
    return this.workspaceService.getPlatformWorkspace(id);
  }

  /**
   * Updates any workspace only with the platform write permission.
   * @param id - Identifier of the target record.
   * @param input - Requested metadata and permission changes.
   * @returns Persisted workspace after the platform-authorized change.
   */
  @Mutation(() => Workspace)
  updatePlatformWorkspace(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateWorkspaceInput,
  ) {
    return this.workspaceService.updatePlatformWorkspace(id, input);
  }

  /**
   * Deletes any workspace only with the platform delete permission.
   * @param id - Identifier of the target record.
   * @returns Metadata of the deleted workspace.
   */
  @Mutation(() => Workspace)
  deletePlatformWorkspace(@Args("id", { type: () => ID }) id: string) {
    return this.workspaceService.deletePlatformWorkspace(id);
  }

  /**
   * Returns the workspace selected for the current request.
   * @returns Current workspace, or null when none is selected.
   */
  @Query(() => Workspace, { nullable: true })
  currentWorkspace(): Workspace | null {
    return this.workspaceService.getCurrentWorkspace();
  }

  /**
   * Returns a workspace by ID.
   * @param id - Workspace identifier.
   * @param user - The user whose account is being accessed.
   * @returns Matching workspace, or null when not found.
   */
  @Query(() => Workspace, { nullable: true })
  async workspace(
    @Args({ name: "id", type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<Workspace | null> {
    return await this.workspaceService.getUserWorkspace(id, user);
  }

  /**
   * Creates a workspace for the current user.
   * @param user - Currently authenticated user.
   * @param input - Workspace creation input.
   * @returns Created workspace identifier; subsequent requests must explicitly select it.
   */
  @Mutation(() => CreateWorkspacePayload)
  async createWorkspace(
    @CurrentUser() user: User,
    @Args("input") input: CreateWorkspaceInput,
  ): Promise<CreateWorkspacePayload> {
    const workspace = await this.workspaceService.createWorkspace(user, input);
    return { id: workspace.id };
  }

  /**
   * Updates the current workspace.
   * @param id - Current workspace identifier.
   * @param input - Workspace update input.
   * @returns Updated workspace identifier.
   */
  @Mutation(() => UpdateWorkspacePayload)
  async updateWorkspace(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateWorkspaceInput,
  ): Promise<UpdateWorkspacePayload> {
    const workspace = await this.workspaceService.updateWorkspace(id, input);
    return { id: workspace.id };
  }

  /**
   * Soft-deletes the current workspace.
   * @param id - Current workspace identifier.
   * @returns Identifier of the permanently deleted workspace.
   */
  @Mutation(() => DeleteWorkspacePayload)
  async deleteWorkspace(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<DeleteWorkspacePayload> {
    const workspace = await this.workspaceService.deleteWorkspace(id);
    return { id: workspace.id };
  }

  /**
   * Leaves the workspace and returns the removed member's ID.
   * @param member - The workspace membership to inspect or change.
   * @returns Identifier of the removed membership.
   */
  @Mutation(() => LeaveWorkspacePayload)
  async leaveWorkspace(
    @CurrentWorkspaceMember() member: WorkspaceMember,
  ): Promise<LeaveWorkspacePayload> {
    const removed = await this.workspaceMemberService.leaveWorkspace(member);
    return { memberId: removed.id };
  }
}
