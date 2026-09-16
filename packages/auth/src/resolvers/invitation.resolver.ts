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
import { InvitationService } from "../services/invitation.service.js";
import { AcceptInvitationResult } from "../types/accept-invitation-result.type.js";

/** 工作区邀请 GraphQL 解析器。 */
@Resolver(() => Invitation)
export class InvitationResolver {
  /** 创建工作区邀请解析器。 */
  constructor(
    /** 认证模块提供的工作区领域服务。 */
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

  /** 根据邀请 ID 查询邀请。 */
  @Query(() => Invitation, { nullable: true })
  async invitation(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Invitation | null> {
    return await this.invitationService.getInvitation(id);
  }

  /** 创建当前工作区的邀请。 */
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

  /** 接受发送给当前用户的邀请。 */
  @Mutation(() => AcceptInvitationResult)
  async acceptInvitation(
    @Args("id", { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<AcceptInvitationResult> {
    const result = await this.invitationService.acceptInvitation(user, id);
    if (!result) throw new NotFoundException("Workspace invitation not found");
    return result;
  }

  /** 拒绝发送给当前用户的邀请。 */
  @Mutation(() => Invitation)
  async rejectInvitation(
    @Args("id", { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<Invitation> {
    return await this.invitationService.rejectInvitation(user, id);
  }

  /** 取消当前工作区的邀请。 */
  @Mutation(() => Invitation)
  async cancelInvitation(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Invitation> {
    return await this.invitationService.cancelInvitation(id);
  }
}
