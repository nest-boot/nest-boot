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

import { CurrentUser } from "../decorators/current-user.decorator.js";
import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { Invitation } from "../entities/invitation.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { CreateInvitationInput } from "../inputs/create-invitation.input.js";
import { AcceptInvitationPayload } from "../objects/accept-invitation-payload.object.js";
import { InvitationService } from "../services/invitation.service.js";

/** GraphQL resolver for workspace invitations. */
@Resolver(() => Invitation)
export class InvitationResolver {
  /** Creates the workspace invitation resolver. */
  constructor(
    /** Invitation domain service provided by the auth module. */
    readonly invitationService: InvitationService,
  ) {}

  /** Resolves the invitation's sender through the authorized service. */
  @ResolveField(() => User)
  async inviter(@Parent() invitation: Invitation): Promise<User> {
    return await this.invitationService.getInvitationInviter(invitation);
  }

  /** Resolves the invitation's workspace, including for recipients before joining. */
  @ResolveField(() => Workspace)
  async workspace(@Parent() invitation: Invitation): Promise<Workspace> {
    return await this.invitationService.getInvitationWorkspace(invitation);
  }

  /** Returns an invitation by ID. */
  @Query(() => Invitation, { nullable: true })
  async invitation(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Invitation | null> {
    return await this.invitationService.getInvitation(id);
  }

  /** Creates an invitation for the current workspace. */
  @Mutation(() => Invitation)
  async createInvitation(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentUser() user: User,
    @Args("input") input: CreateInvitationInput,
  ): Promise<Invitation> {
    return await this.invitationService.createInvitation(
      workspace,
      user,
      input,
    );
  }

  /** Accepts an invitation addressed to the current user. */
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

  /** Rejects an invitation addressed to the current user. */
  @Mutation(() => Invitation)
  async rejectInvitation(
    @Args("id", { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<Invitation> {
    return await this.invitationService.rejectInvitation(user, id);
  }

  /** Cancels an invitation in the current workspace. */
  @Mutation(() => Invitation)
  async cancelInvitation(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Invitation> {
    return await this.invitationService.cancelInvitation(id);
  }
}
