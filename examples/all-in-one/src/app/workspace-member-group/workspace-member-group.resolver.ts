import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nest-boot/graphql';
import { ConnectionManager } from '@nest-boot/graphql-connection';
import { Can, PermissionAction } from '@nest-boot/permission';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator.js';
import { Workspace } from '../workspace/workspace.entity.js';
import {
  WorkspaceMemberConnection,
  WorkspaceMemberConnectionArgs,
} from '../workspace-member/workspace-member.connection-definition.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { CreateWorkspaceMemberGroupInput } from './inputs/create-workspace-member-group.input.js';
import { UpdateWorkspaceMemberGroupInput } from './inputs/update-workspace-member-group.input.js';
import {
  WorkspaceMemberGroupConnection,
  WorkspaceMemberGroupConnectionArgs,
} from './workspace-member-group.connection-definition.js';
import { WorkspaceMemberGroup } from './workspace-member-group.entity.js';
import { WorkspaceMemberGroupService } from './workspace-member-group.service.js';

/** 工作区成员组 GraphQL 解析器。 */
@Resolver(() => WorkspaceMemberGroup)
export class WorkspaceMemberGroupResolver {
  /**
   * 创建工作区成员组解析器。
   *
   * @param workspaceMemberGroupService - 工作区成员组领域服务。
   * @param cm - GraphQL 连接查询管理器。
   */
  constructor(
    /** 工作区成员组领域服务。 */
    private readonly workspaceMemberGroupService: WorkspaceMemberGroupService,
    /** GraphQL 连接查询管理器。 */
    private readonly cm: ConnectionManager,
  ) {}

  /**
   * 分页查询当前工作区的成员组。
   *
   * @param workspace - 当前工作区。
   * @param args - 分页、筛选和排序参数。
   * @returns 工作区成员组分页结果。
   */
  @Can(PermissionAction.READ, WorkspaceMemberGroup)
  @Query(() => WorkspaceMemberGroupConnection)
  async workspaceMemberGroups(
    @CurrentWorkspace() workspace: Workspace,
    @Args() args: WorkspaceMemberGroupConnectionArgs,
  ): Promise<WorkspaceMemberGroupConnection> {
    return await this.cm.find(WorkspaceMemberGroupConnection, args, {
      where: {
        workspace,
      },
    });
  }

  /**
   * 查询当前工作区内的指定成员组。
   *
   * @param workspace - 当前工作区。
   * @param id - 成员组 ID。
   * @returns 匹配的工作区成员组。
   */
  @Can(PermissionAction.READ, WorkspaceMemberGroup)
  @Query(() => WorkspaceMemberGroup)
  async workspaceMemberGroup(
    @CurrentWorkspace() workspace: Workspace,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WorkspaceMemberGroup> {
    return await this.workspaceMemberGroupService.findOneOrFail({
      id,
      workspace,
    });
  }

  /**
   * 创建工作区成员组。
   *
   * @param workspace - 当前工作区。
   * @param input - 成员组创建参数。
   * @returns 创建完成的工作区成员组。
   */
  @Can(PermissionAction.CREATE, WorkspaceMemberGroup)
  @Mutation(() => WorkspaceMemberGroup)
  async createWorkspaceMemberGroup(
    @CurrentWorkspace() workspace: Workspace,
    @Args('input') input: CreateWorkspaceMemberGroupInput,
  ): Promise<WorkspaceMemberGroup> {
    return await this.workspaceMemberGroupService.createWorkspaceMemberGroup(
      workspace,
      input,
    );
  }

  /**
   * 更新工作区成员组。
   *
   * @param workspace - 当前工作区。
   * @param id - 待更新的成员组 ID。
   * @param input - 成员组更新参数。
   * @returns 更新后的工作区成员组。
   */
  @Can(PermissionAction.UPDATE, WorkspaceMemberGroup)
  @Mutation(() => WorkspaceMemberGroup)
  async updateWorkspaceMemberGroup(
    @CurrentWorkspace() workspace: Workspace,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateWorkspaceMemberGroupInput,
  ): Promise<WorkspaceMemberGroup> {
    const group = await this.workspaceMemberGroupService.findOneOrFail({
      id,
      workspace,
    });

    return await this.workspaceMemberGroupService.updateWorkspaceMemberGroup(
      group,
      input,
    );
  }

  /**
   * 删除工作区成员组。
   *
   * @param workspace - 当前工作区。
   * @param id - 待删除的成员组 ID。
   * @returns 被删除的工作区成员组。
   */
  @Can(PermissionAction.DELETE, WorkspaceMemberGroup)
  @Mutation(() => WorkspaceMemberGroup)
  async deleteWorkspaceMemberGroup(
    @CurrentWorkspace() workspace: Workspace,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WorkspaceMemberGroup> {
    const group = await this.workspaceMemberGroupService.findOneOrFail({
      id,
      workspace,
    });

    return await this.workspaceMemberGroupService.remove(group);
  }

  /**
   * 向成员组批量添加成员。
   *
   * @param id - 成员组 ID。
   * @param memberIds - 待添加的成员 ID 列表。
   * @returns 添加成员后的工作区成员组。
   */
  @Can(PermissionAction.UPDATE, WorkspaceMemberGroup)
  @Mutation(() => WorkspaceMemberGroup)
  async addMembersToWorkspaceMemberGroup(
    @Args('id', { type: () => ID }) id: string,
    @Args('memberIds', { type: () => [ID] }) memberIds: string[],
  ): Promise<WorkspaceMemberGroup> {
    return await this.workspaceMemberGroupService.addMembers(id, memberIds);
  }

  /**
   * 从成员组批量移除成员。
   *
   * @param id - 成员组 ID。
   * @param memberIds - 待移除的成员 ID 列表。
   * @returns 移除成员后的工作区成员组。
   */
  @Can(PermissionAction.UPDATE, WorkspaceMemberGroup)
  @Mutation(() => WorkspaceMemberGroup)
  async removeMembersFromWorkspaceMemberGroup(
    @Args('id', { type: () => ID }) id: string,
    @Args('memberIds', { type: () => [ID] }) memberIds: string[],
  ): Promise<WorkspaceMemberGroup> {
    return await this.workspaceMemberGroupService.removeMembers(id, memberIds);
  }

  /**
   * 分页解析成员组下的成员。
   *
   * @param group - 父级工作区成员组。
   * @param args - 分页、筛选和排序参数。
   * @returns 工作区成员分页结果。
   */
  @Can(PermissionAction.READ, WorkspaceMember)
  @ResolveField(() => WorkspaceMemberConnection)
  async members(
    @Parent() group: WorkspaceMemberGroup,
    @Args() args: WorkspaceMemberConnectionArgs,
  ): Promise<WorkspaceMemberConnection> {
    return await this.cm.find(WorkspaceMemberConnection, args, {
      where: {
        groupMembers: {
          group,
        },
      },
    });
  }
}
