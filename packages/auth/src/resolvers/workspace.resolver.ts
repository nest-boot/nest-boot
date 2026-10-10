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
import type { ConnectionArgsInterface } from "@nest-boot/graphql-connection";
import type { GraphQLResolveInfo } from "graphql";

import {
  MemberConnection,
  MemberConnectionArgs,
} from "../connections/member.connection-definition.js";
import {
  MemberApiKeyConnection,
  MemberApiKeyConnectionArgs,
} from "../connections/member-api-key.connection-definition.js";
import { CurrentMember } from "../decorators/current-member.decorator.js";
import { CurrentUser } from "../decorators/current-user.decorator.js";
import { type Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import {
  InvitationConnection,
  InvitationConnectionArgs,
} from "../features/invitations/invitation.connection-definition.js";
import { InvitationService } from "../features/invitations/invitation.service.js";
import { CreateWorkspaceInput } from "../inputs/create-workspace.input.js";
import { UpdateWorkspaceInput } from "../inputs/update-workspace.input.js";
import { CreateWorkspacePayload } from "../objects/create-workspace-payload.object.js";
import { DeleteWorkspacePayload } from "../objects/delete-workspace-payload.object.js";
import { LeaveWorkspacePayload } from "../objects/leave-workspace-payload.object.js";
import { UpdateWorkspacePayload } from "../objects/update-workspace-payload.object.js";
import { MemberService } from "../services/member.service.js";
import { MemberApiKeyService } from "../services/member-api-key.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/**
 * GraphQL operations for querying, creating, updating, and deleting workspaces.
 */
@Resolver(() => Workspace)
export class WorkspaceResolver {
  /**
   * Creates the workspace resolver.
   * @param workspaceService - Workspace domain service.
   * @param apiKeyService - API key domain service.
   * @param memberService - Workspace member domain service.
   * @param invitationService - Workspace invitation domain service.
   */
  constructor(
    readonly workspaceService: WorkspaceService,
    readonly apiKeyService: MemberApiKeyService,
    readonly memberService: MemberService,
    readonly invitationService: InvitationService,
  ) {}

  /**
   * Paginates members of the parent workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated members visible in the workspace.
   */
  @ResolveField(() => MemberConnection)
  async members(
    @Parent() workspace: Workspace,
    @Args({ type: () => MemberConnectionArgs })
    args: ConnectionArgsInterface<Member>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.memberService.getMemberConnectionByWorkspace(
      workspace,
      args,
      info,
    );
  }

  /**
   * Returns an accessible API key owned by the parent workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param id - Identifier of the record to access.
   * @returns Accessible API key metadata, or null if unavailable.
   */
  @ResolveField(() => MemberApiKey, { nullable: true })
  async apiKey(
    @Parent() workspace: Workspace,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKeyMetadata<MemberApiKey> | null> {
    return await this.apiKeyService.getMemberApiKey(id, workspace);
  }

  /**
   * Paginates API keys owned by the parent workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated API key metadata with credential hashes omitted.
   */
  @ResolveField(() => MemberApiKeyConnection)
  async apiKeys(
    @Parent() workspace: Workspace,
    @Args({ type: () => MemberApiKeyConnectionArgs })
    args: ConnectionArgsInterface<MemberApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.apiKeyService.getMemberApiKeyConnection(
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
  @ResolveField(() => InvitationConnection)
  async invitations(
    @Parent() workspace: Workspace,
    @Args({ type: () => InvitationConnectionArgs })
    args: ConnectionArgsInterface<Invitation>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.invitationService.getInvitationConnectionByWorkspace(
      workspace,
      args,
      info,
    );
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
    @CurrentMember() member: Member,
  ): Promise<LeaveWorkspacePayload> {
    const removed = await this.memberService.leaveWorkspace(member);
    return { memberId: removed.id };
  }
}
