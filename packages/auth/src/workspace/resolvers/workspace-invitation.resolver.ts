import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import { NotFoundException } from "@nestjs/common";

import { AuthUser } from "../../core/decorators/auth-user.decorator.js";
import { User } from "../../core/entities/user.entity.js";
import { SelectedWorkspace } from "../decorators/selected-workspace.decorator.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceInvitation } from "../entities/workspace-invitation.entity.js";
import { CreateWorkspaceInvitationInput } from "../inputs/create-workspace-invitation.input.js";
import { AcceptWorkspaceInvitationPayload } from "../objects/accept-workspace-invitation-payload.object.js";
import { CancelWorkspaceInvitationPayload } from "../objects/cancel-workspace-invitation-payload.object.js";
import { CreateWorkspaceInvitationPayload } from "../objects/create-workspace-invitation-payload.object.js";
import { RejectWorkspaceInvitationPayload } from "../objects/reject-workspace-invitation-payload.object.js";
import { WorkspaceInvitationService } from "../services/workspace-invitation.service.js";

/** GraphQL resolver for workspace invitations. */
@Resolver(() => WorkspaceInvitation)
export class WorkspaceInvitationResolver {
  /**
   * Creates the workspace invitation resolver.
   * @param workspaceInvitationService - Service for invitation queries and mutations.
   */
  constructor(
    /** WorkspaceInvitation domain service provided by the auth module. */
    readonly workspaceInvitationService: WorkspaceInvitationService,
  ) {}

  /**
   * Resolves the invitation's sender through the authorized service.
   * @param invitation - WorkspaceInvitation being inspected or changed.
   * @returns User who sent the invitation.
   */
  @ResolveField(() => User)
  async inviter(@Parent() invitation: WorkspaceInvitation): Promise<User> {
    return await this.workspaceInvitationService.getWorkspaceInvitationInviter(
      invitation,
    );
  }

  /**
   * Resolves the invitation's workspace, including for recipients before joining.
   * @param invitation - WorkspaceInvitation being inspected or changed.
   * @returns Workspace associated with the invitation.
   */
  @ResolveField(() => Workspace)
  async workspace(
    @Parent() invitation: WorkspaceInvitation,
  ): Promise<Workspace> {
    return await this.workspaceInvitationService.getWorkspaceInvitationWorkspace(
      invitation,
    );
  }

  /**
   * Returns an invitation by ID.
   * @param id - Identifier of the record to access.
   * @returns Accessible invitation, or null if it does not exist.
   */
  @Query(() => WorkspaceInvitation, { nullable: true })
  async workspaceInvitation(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<WorkspaceInvitation | null> {
    return await this.workspaceInvitationService.getWorkspaceInvitation(id);
  }

  /**
   * Creates an invitation for the current workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param user - The user whose account is being accessed.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the created invitation.
   */
  @Mutation(() => CreateWorkspaceInvitationPayload)
  async createWorkspaceInvitation(
    @SelectedWorkspace() workspace: Workspace,
    @AuthUser() user: User,
    @Args("input") input: CreateWorkspaceInvitationInput,
  ): Promise<CreateWorkspaceInvitationPayload> {
    const invitation =
      await this.workspaceInvitationService.createWorkspaceInvitation(
        workspace,
        user,
        input,
      );
    return { id: invitation.id };
  }

  /**
   * Accepts an invitation addressed to the current user.
   * @param id - Identifier of the record to access.
   * @param user - The user whose account is being accessed.
   * @returns Accepted invitation, membership, and workspace identifiers.
   */
  @Mutation(() => AcceptWorkspaceInvitationPayload)
  async acceptWorkspaceInvitation(
    @Args("id", { type: () => ID }) id: string,
    @AuthUser() user: User,
  ): Promise<AcceptWorkspaceInvitationPayload> {
    const result =
      await this.workspaceInvitationService.acceptWorkspaceInvitation(user, id);
    if (!result) {
      throw new NotFoundException("Workspace invitation not found");
    }
    return {
      id: result.invitation.id,
      memberId: result.member.id,
      workspaceId: result.invitation.workspace.id,
    };
  }

  /**
   * Rejects an invitation addressed to the current user.
   * @param id - Identifier of the record to access.
   * @param user - The user whose account is being accessed.
   * @returns Identifier of the rejected invitation.
   */
  @Mutation(() => RejectWorkspaceInvitationPayload)
  async rejectWorkspaceInvitation(
    @Args("id", { type: () => ID }) id: string,
    @AuthUser() user: User,
  ): Promise<RejectWorkspaceInvitationPayload> {
    const invitation =
      await this.workspaceInvitationService.rejectWorkspaceInvitation(user, id);
    return { id: invitation.id };
  }

  /**
   * Cancels an invitation in the current workspace.
   * @param id - Identifier of the record to access.
   * @returns Identifier of the canceled invitation.
   */
  @Mutation(() => CancelWorkspaceInvitationPayload)
  async cancelWorkspaceInvitation(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<CancelWorkspaceInvitationPayload> {
    const invitation =
      await this.workspaceInvitationService.cancelWorkspaceInvitation(id);
    return { id: invitation.id };
  }
}
