import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import type { ConnectionArgsInterface } from "@nest-boot/graphql-connection";

import {
  ApiKeyConnection,
  ApiKeyConnectionArgs,
} from "../connections/api-key.connection-definition.js";
import {
  InvitationConnection,
  InvitationConnectionArgs,
} from "../connections/invitation.connection-definition.js";
import {
  MemberConnection,
  MemberConnectionArgs,
} from "../connections/member.connection-definition.js";
import { CurrentMember } from "../decorators/current-member.decorator.js";
import { CurrentUser } from "../decorators/current-user.decorator.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { type Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { CreateWorkspaceInput } from "../inputs/create-workspace.input.js";
import { UpdateWorkspaceInput } from "../inputs/update-workspace.input.js";
import { CreateWorkspacePayload } from "../objects/create-workspace-payload.object.js";
import { DeleteWorkspacePayload } from "../objects/delete-workspace-payload.object.js";
import { LeaveWorkspacePayload } from "../objects/leave-workspace-payload.object.js";
import { ApiKeyService } from "../services/api-key.service.js";
import { InvitationService } from "../services/invitation.service.js";
import { MemberService } from "../services/member.service.js";
import { WorkspaceService } from "../services/workspace.service.js";

/**
 * GraphQL operations for querying, creating, updating, and deleting workspaces.
 */
@Resolver(() => Workspace)
export class WorkspaceResolver {
  /**
   * Creates the workspace resolver.
   *
   * @param workspaceService - Workspace domain service.
   * @param apiKeyService - API key domain service.
   * @param memberService - Workspace member domain service.
   * @param invitationService - Workspace invitation domain service.
   */
  constructor(
    readonly workspaceService: WorkspaceService,
    readonly apiKeyService: ApiKeyService,
    readonly memberService: MemberService,
    readonly invitationService: InvitationService,
  ) {}

  /** Paginates members of the parent workspace. */
  @ResolveField(() => MemberConnection)
  async members(
    @Parent() workspace: Workspace,
    @Args({ type: () => MemberConnectionArgs })
    args: ConnectionArgsInterface<Member>,
  ) {
    return await this.memberService.getMemberConnectionByWorkspace(
      workspace,
      args,
    );
  }

  /** Returns an accessible API key owned by the parent workspace. */
  @ResolveField(() => ApiKey, { nullable: true })
  async apiKey(
    @Parent() workspace: Workspace,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKey | null> {
    return await this.apiKeyService.getWorkspaceApiKey(id, workspace);
  }

  /** Paginates API keys owned by the parent workspace. */
  @ResolveField(() => ApiKeyConnection)
  async apiKeys(
    @Parent() workspace: Workspace,
    @Args({ type: () => ApiKeyConnectionArgs })
    args: ConnectionArgsInterface<ApiKey>,
  ) {
    return await this.apiKeyService.getApiKeyConnectionByWorkspace(
      workspace,
      args,
    );
  }

  /** Paginates workspace invitations with authorization and querying handled by the service. */
  @ResolveField(() => InvitationConnection)
  async invitations(
    @Parent() workspace: Workspace,
    @Args({ type: () => InvitationConnectionArgs })
    args: ConnectionArgsInterface<Invitation>,
  ) {
    return await this.invitationService.getInvitationConnectionByWorkspace(
      workspace,
      args,
    );
  }

  /**
   * Returns the workspace selected for the current request.
   *
   * @returns Current workspace, or null when none is selected.
   */
  @Query(() => Workspace, { nullable: true })
  currentWorkspace(): Workspace | null {
    return this.workspaceService.getCurrentWorkspace();
  }

  /**
   * Returns a workspace by ID.
   *
   * @param id - Workspace identifier.
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
   *
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
   *
   * @param id - Current workspace identifier.
   * @param input - Workspace update input.
   * @returns Updated workspace.
   */
  @Mutation(() => Workspace)
  async updateWorkspace(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateWorkspaceInput,
  ): Promise<Workspace> {
    return await this.workspaceService.updateWorkspace(id, input);
  }

  /**
   * Soft-deletes the current workspace.
   *
   * @param id - Current workspace identifier.
   * @returns Identifier of the soft-deleted workspace.
   */
  @Mutation(() => DeleteWorkspacePayload)
  async deleteWorkspace(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<DeleteWorkspacePayload> {
    const workspace = await this.workspaceService.deleteWorkspace(id);
    return { id: workspace.id };
  }

  /** Leaves the workspace and returns the removed member's ID. */
  @Mutation(() => LeaveWorkspacePayload)
  async leaveWorkspace(
    @CurrentMember() member: Member,
  ): Promise<LeaveWorkspacePayload> {
    const removed = await this.memberService.leaveWorkspace(member);
    return { memberId: removed.id };
  }
}
