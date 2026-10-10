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

import { CurrentUser } from "../../decorators/current-user.decorator.js";
import { CurrentWorkspace } from "../../decorators/current-workspace.decorator.js";
import { Invitation } from "../../entities/invitation.entity.js";
import { User } from "../../entities/user.entity.js";
import { Workspace } from "../../entities/workspace.entity.js";
import { AcceptInvitationPayload } from "./accept-invitation-payload.object.js";
import { CancelInvitationPayload } from "./cancel-invitation-payload.object.js";
import { CreateInvitationInput } from "./create-invitation.input.js";
import { CreateInvitationPayload } from "./create-invitation-payload.object.js";
import { InvitationService } from "./invitation.service.js";
import { RejectInvitationPayload } from "./reject-invitation-payload.object.js";

/** GraphQL resolver for workspace invitations. */
@Resolver(() => Invitation)
export class InvitationResolver {
  /**
   * Creates the workspace invitation resolver.
   * @param invitationService - Service for invitation queries and mutations.
   */
  constructor(
    /** Invitation domain service provided by the auth module. */
    readonly invitationService: InvitationService,
  ) {}

  /**
   * Resolves the invitation's sender through the authorized service.
   * @param invitation - Invitation being inspected or changed.
   * @returns User who sent the invitation.
   */
  @ResolveField(() => User)
  async inviter(@Parent() invitation: Invitation): Promise<User> {
    return await this.invitationService.getInvitationInviter(invitation);
  }

  /**
   * Resolves the invitation's workspace, including for recipients before joining.
   * @param invitation - Invitation being inspected or changed.
   * @returns Workspace associated with the invitation.
   */
  @ResolveField(() => Workspace)
  async workspace(@Parent() invitation: Invitation): Promise<Workspace> {
    return await this.invitationService.getInvitationWorkspace(invitation);
  }

  /**
   * Returns an invitation by ID.
   * @param id - Identifier of the record to access.
   * @returns Accessible invitation, or null if it does not exist.
   */
  @Query(() => Invitation, { nullable: true })
  async invitation(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Invitation | null> {
    return await this.invitationService.getInvitation(id);
  }

  /**
   * Creates an invitation for the current workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param user - The user whose account is being accessed.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the created invitation.
   */
  @Mutation(() => CreateInvitationPayload)
  async createInvitation(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentUser() user: User,
    @Args("input") input: CreateInvitationInput,
  ): Promise<CreateInvitationPayload> {
    const invitation = await this.invitationService.createInvitation(
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
  @Mutation(() => AcceptInvitationPayload)
  async acceptInvitation(
    @Args("id", { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<AcceptInvitationPayload> {
    const result = await this.invitationService.acceptInvitation(user, id);
    if (!result) throw new NotFoundException("Workspace invitation not found");
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
  @Mutation(() => RejectInvitationPayload)
  async rejectInvitation(
    @Args("id", { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<RejectInvitationPayload> {
    const invitation = await this.invitationService.rejectInvitation(user, id);
    return { id: invitation.id };
  }

  /**
   * Cancels an invitation in the current workspace.
   * @param id - Identifier of the record to access.
   * @returns Identifier of the canceled invitation.
   */
  @Mutation(() => CancelInvitationPayload)
  async cancelInvitation(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<CancelInvitationPayload> {
    const invitation = await this.invitationService.cancelInvitation(id);
    return { id: invitation.id };
  }
}
