import {
  Can,
  CurrentUser,
  CurrentWorkspace,
  CurrentWorkspaceMember,
  WorkspaceService,
} from '@nest-boot/auth';
import { Args, ID, Mutation, Query, Resolver } from '@nest-boot/graphql';
import { ConnectionManager } from '@nest-boot/graphql-connection';

import { User } from '../user/user.entity.js';
import { WorkspaceInvitation } from '../workspace-member/workspace-invitation.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { CreateWorkspaceInput } from './inputs/create-workspace.input.js';
import { UpdateWorkspaceInput } from './inputs/update-workspace.input.js';
import {
  WorkspaceConnection,
  WorkspaceConnectionArgs,
} from './workspace.connection-definition.js';
import { Workspace } from './workspace.entity.js';

/**
 * 提供工作区查询、创建、更新和删除的 GraphQL 接口。
 */
@Resolver(() => Workspace)
export class WorkspaceResolver {
  /**
   * 创建工作区 Resolver。
   *
   * @param workspaceService - 工作区业务服务。
   * @param cm - GraphQL 连接分页管理器。
   */
  constructor(
    private readonly workspaceService: WorkspaceService<
      Workspace,
      WorkspaceMember,
      WorkspaceInvitation,
      User
    >,
    private readonly cm: ConnectionManager,
  ) {}

  /**
   * 返回当前请求选择的工作区。
   *
   * @param workspace - 当前请求工作区。
   * @returns 当前工作区；请求未选择工作区时返回 null。
   */
  @Can('read', Workspace)
  @Query(() => Workspace, { nullable: true })
  currentWorkspace(
    @CurrentWorkspace() workspace?: Workspace,
  ): Workspace | null {
    return workspace ?? null;
  }

  /**
   * 按标识查询单个工作区。
   *
   * @param id - 工作区标识。
   * @returns 匹配的工作区；不存在时返回空值。
   */
  @Can('read', Workspace, { scope: 'user' })
  @Query(() => Workspace, { nullable: true })
  async workspace(
    @Args({ name: 'id', type: () => ID }) id: string,
  ): Promise<Workspace | null> {
    return await this.workspaceService.findOne({ id });
  }

  /**
   * 分页查询当前用户加入的工作区。
   *
   * @param user - 当前认证用户。
   * @param args - 连接分页与过滤参数。
   * @returns 工作区分页查询结果。
   */
  @Can('read', Workspace, { scope: 'user' })
  @Query(() => WorkspaceConnection)
  async workspaces(
    @CurrentUser() user: User,
    @Args() args: WorkspaceConnectionArgs,
  ) {
    return await this.cm.find(WorkspaceConnection, args, {
      where: {
        members: {
          user,
        },
      },
    });
  }

  /**
   * 为当前用户创建新工作区。
   *
   * @param user - 当前认证用户。
   * @param input - 创建工作区输入参数。
   * @returns 创建完成的工作区。
   */
  @Can('create', Workspace, { scope: 'user' })
  @Mutation(() => Workspace)
  async createWorkspace(
    @CurrentUser() user: User,
    @Args('input') input: CreateWorkspaceInput,
  ): Promise<Workspace> {
    return await this.workspaceService.createWorkspace(user, input);
  }

  /**
   * 更新当前工作区信息。
   *
   * @param workspace - 当前工作区。
   * @param input - 更新工作区输入参数。
   * @returns 更新后的工作区。
   */
  @Can('update', Workspace)
  @Mutation(() => Workspace)
  async updateWorkspace(
    @CurrentWorkspace() workspace: Workspace,
    @Args('input') input: UpdateWorkspaceInput,
  ): Promise<Workspace> {
    return await this.workspaceService.updateWorkspace(workspace, input);
  }

  /**
   * 删除当前工作区的兼容旧接口。
   *
   * @param workspace - 当前工作区。
   * @param workspaceMember - 当前请求的工作区成员。
   * @returns 已删除的工作区。
   */
  @Can('delete', Workspace)
  @Mutation(() => Workspace, {
    deprecationReason: 'Use deleteWorkspace instead',
  })
  async removeWorkspace(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() workspaceMember: WorkspaceMember,
  ): Promise<Workspace> {
    return await this.deleteWorkspace(workspace, workspaceMember);
  }

  /**
   * 软删除当前工作区。
   *
   * @param workspace - 当前工作区。
   * @param workspaceMember - 当前请求的工作区成员。
   * @returns 已软删除的工作区。
   */
  @Can('delete', Workspace)
  @Mutation(() => Workspace)
  async deleteWorkspace(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() workspaceMember: WorkspaceMember,
  ): Promise<Workspace> {
    return await this.workspaceService.deleteWorkspace(
      workspace,
      workspaceMember,
    );
  }
}
