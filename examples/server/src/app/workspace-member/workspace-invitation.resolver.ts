import {
  CurrentUser,
  CurrentWorkspace,
  CurrentWorkspaceMember,
  UserCan,
  WorkspaceCan,
  WorkspaceService,
} from '@nest-boot/auth';
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nest-boot/graphql';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { CreateWorkspaceInvitationInput } from './inputs/create-workspace-invitation.input.js';
import { AcceptWorkspaceInvitationResult } from './types/accept-workspace-invitation-result.type.js';
import { WorkspaceInvitation } from './workspace-invitation.entity.js';
import { WorkspaceMember } from './workspace-member.entity.js';

/** 工作区邀请 GraphQL 解析器。 */
@Resolver(() => WorkspaceInvitation)
export class WorkspaceInvitationResolver {
  /** 创建工作区邀请解析器。 */
  constructor(
    /** 认证模块提供的工作区领域服务。 */
    private readonly workspaceService: WorkspaceService<
      Workspace,
      WorkspaceMember,
      WorkspaceInvitation,
      User
    >,
  ) {}

  /** 根据邀请 ID 查询邀请。 */
  @UserCan('read', WorkspaceInvitation)
  @Query(() => WorkspaceInvitation, { nullable: true })
  async workspaceInvitation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<WorkspaceInvitation | null> {
    return await this.workspaceService.getUserInvitation(id, user);
  }

  /** 查询当前工作区的邀请记录。 */
  @WorkspaceCan('read', WorkspaceInvitation)
  @Query(() => [WorkspaceInvitation])
  async workspaceInvitations(
    @CurrentWorkspace() workspace: Workspace,
  ): Promise<WorkspaceInvitation[]> {
    return await this.workspaceService.listInvitations(workspace);
  }

  /** 查询当前用户收到的待处理邀请。 */
  @UserCan('read', WorkspaceInvitation)
  @Query(() => [WorkspaceInvitation])
  async currentUserWorkspaceInvitations(
    @CurrentUser() user: User,
  ): Promise<WorkspaceInvitation[]> {
    return await this.workspaceService.listUserInvitations(user);
  }

  /** 创建当前工作区的邀请。 */
  @WorkspaceCan('create', WorkspaceInvitation)
  @Mutation(() => WorkspaceInvitation)
  async createWorkspaceInvitation(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() member: WorkspaceMember,
    @CurrentUser() user: User,
    @Args('input') input: CreateWorkspaceInvitationInput,
  ): Promise<WorkspaceInvitation> {
    if (input.roles.includes('owner') && !member.roles.includes('owner')) {
      throw new ForbiddenException(
        'Only workspace owners can invite another owner',
      );
    }
    return await this.workspaceService.createInvitation(workspace, user, input);
  }

  /** 接受发送给当前用户的邀请。 */
  @UserCan('update', WorkspaceInvitation)
  @Mutation(() => AcceptWorkspaceInvitationResult)
  async acceptWorkspaceInvitation(
    @Args('invitationId', { type: () => ID }) invitationId: string,
    @CurrentUser() user: User,
  ): Promise<AcceptWorkspaceInvitationResult> {
    const result = await this.workspaceService.acceptInvitation(
      user,
      invitationId,
    );
    if (!result) throw new NotFoundException('Workspace invitation not found');
    return result;
  }

  /** 拒绝发送给当前用户的邀请。 */
  @UserCan('update', WorkspaceInvitation)
  @Mutation(() => WorkspaceInvitation)
  async rejectWorkspaceInvitation(
    @Args('invitationId', { type: () => ID }) invitationId: string,
    @CurrentUser() user: User,
  ): Promise<WorkspaceInvitation> {
    const invitation = await this.workspaceService.getUserInvitation(
      invitationId,
      user,
    );
    if (!invitation)
      throw new NotFoundException('Workspace invitation not found');
    return await this.workspaceService.rejectInvitation(user, invitation);
  }

  /** 取消当前工作区的邀请。 */
  @WorkspaceCan('cancel', WorkspaceInvitation)
  @Mutation(() => WorkspaceInvitation)
  async cancelWorkspaceInvitation(
    @Args('invitationId', { type: () => ID }) invitationId: string,
    @CurrentWorkspace() workspace: Workspace,
  ): Promise<WorkspaceInvitation> {
    const invitation = await this.workspaceService.getWorkspaceInvitation(
      invitationId,
      workspace,
    );
    if (!invitation)
      throw new NotFoundException('Workspace invitation not found');
    return await this.workspaceService.cancelInvitation(invitation);
  }

  /** 解析邀请者。 */
  @WorkspaceCan('read', User)
  @ResolveField(() => User)
  async inviter(@Parent() invitation: WorkspaceInvitation): Promise<User> {
    return await invitation.inviter.loadOrFail();
  }

  /** 解析邀请所属工作区。 */
  @WorkspaceCan('read', Workspace)
  @ResolveField(() => Workspace)
  async workspace(
    @Parent() invitation: WorkspaceInvitation,
  ): Promise<Workspace> {
    return await invitation.workspace.loadOrFail();
  }
}
