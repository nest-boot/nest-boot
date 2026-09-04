import {
  type BaseApiKey,
  CurrentApiKey,
  CurrentUser,
  CurrentWorkspace,
  CurrentWorkspaceMember,
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
import { ConnectionManager } from '@nest-boot/graphql-connection';
import { ForbiddenException } from '@nestjs/common';

import { AuthRoleType } from '../auth/types/auth-role.type.js';
import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { AddWorkspaceMemberInput } from './inputs/add-workspace-member.input.js';
import { CreateServiceAccountWorkspaceMemberInput } from './inputs/create-service-account-workspace-member.input.js';
import { SetWorkspaceMemberPermissionsInput } from './inputs/set-workspace-member-permissions.input.js';
import { UpdateWorkspaceMemberInput } from './inputs/update-workspace-member.input.js';
import { UpdateWorkspaceMemberRoleInput } from './inputs/update-workspace-member-role.input.js';
import {
  WorkspaceMemberConnection,
  WorkspaceMemberConnectionArgs,
} from './workspace-member.connection-definition.js';
import { WorkspaceMember } from './workspace-member.entity.js';
import { WorkspaceMemberService } from './workspace-member.service.js';

/** 工作区成员 GraphQL 解析器。 */
@Resolver(() => WorkspaceMember)
export class WorkspaceMemberResolver {
  /**
   * 创建工作区成员解析器。
   *
   * @param workspaceMemberService - 工作区成员领域服务。
   * @param cm - GraphQL 连接查询管理器。
   */
  constructor(
    /** 工作区成员领域服务。 */
    private readonly workspaceMemberService: WorkspaceMemberService,
    /** GraphQL 连接查询管理器。 */
    private readonly cm: ConnectionManager,
    /** Auth-owned workspace role and permission operations. */
    private readonly workspaceService: WorkspaceService,
  ) {}

  /** Lists configured workspace roles. */
  @WorkspaceCan('read', WorkspaceMember)
  @Query(() => [AuthRoleType])
  workspaceRoles(): AuthRoleType[] {
    return this.workspaceService.listRoles();
  }

  /** Lists permissions available to workspace roles. */
  @WorkspaceCan('read', WorkspaceMember)
  @Query(() => [String])
  workspacePermissions(): string[] {
    return this.workspaceService.listPermissions();
  }

  /**
   * 获取当前请求中的工作区成员。
   *
   * @param workspaceMember - 当前请求上下文中的工作区成员。
   * @returns 当前工作区成员；请求未解析出成员时返回 null。
   */
  @Query(() => WorkspaceMember, { nullable: true })
  currentWorkspaceMember(
    @CurrentWorkspaceMember() workspaceMember?: WorkspaceMember,
    @CurrentUser() user?: User,
    @CurrentApiKey() apiKey?: BaseApiKey,
  ): WorkspaceMember | null {
    if (apiKey && user && !workspaceMember) {
      throw new ForbiddenException(
        'The API key owner is not a member of this workspace',
      );
    }
    return workspaceMember ?? null;
  }

  /**
   * 根据 ID 查询工作区成员。
   *
   * @param id - 工作区成员 ID。
   * @returns 匹配的工作区成员，不存在时返回 null。
   */
  @WorkspaceCan('read', WorkspaceMember)
  @Query(() => WorkspaceMember, { nullable: true })
  async workspaceMember(
    @Args('id', { type: () => ID }) id: string,
    @CurrentWorkspace() workspace: Workspace,
  ): Promise<WorkspaceMember | null> {
    return await this.workspaceMemberService.findOne({ id, workspace });
  }

  /**
   * 分页查询工作区成员。
   *
   * @param args - 分页、筛选和排序参数。
   * @param workspace - 当前请求中的工作区。
   * @param workspaceMember - 当前请求中的工作区成员。
   * @returns 工作区成员分页结果。
   */
  @WorkspaceCan('read', WorkspaceMember)
  @Query(() => WorkspaceMemberConnection)
  async workspaceMembers(
    @Args() args: WorkspaceMemberConnectionArgs,
    @CurrentWorkspace() workspace?: Workspace,
    @CurrentWorkspaceMember() workspaceMember?: WorkspaceMember,
  ): Promise<WorkspaceMemberConnection> {
    if (!workspaceMember) {
      throw new ForbiddenException('You are not allowed to view members');
    }

    if (workspace) {
      return await this.cm.find(WorkspaceMemberConnection, args, {
        where: {
          workspace,
        },
      });
    }

    return await this.cm.find(WorkspaceMemberConnection, args);
  }

  /**
   * 通过邮箱直接添加已有用户为工作区成员。
   *
   * @param workspace - 当前工作区。
   * @param input - 添加成员输入参数。
   * @returns 新创建的工作区成员。
   */
  @WorkspaceCan('create', WorkspaceMember)
  @Mutation(() => WorkspaceMember)
  async addWorkspaceMember(
    @CurrentWorkspace() workspace: Workspace,
    @Args('input') input: AddWorkspaceMemberInput,
  ): Promise<WorkspaceMember> {
    return (await this.workspaceService.addMemberByEmail(
      workspace,
      input.email,
    )) as WorkspaceMember;
  }

  /**
   * 创建服务账号工作区成员。
   *
   * @param workspace - 当前工作区。
   * @param input - 服务账号创建参数。
   * @returns 新创建的服务账号成员。
   */
  @WorkspaceCan('create', WorkspaceMember)
  @Mutation(() => WorkspaceMember)
  async createServiceAccountWorkspaceMember(
    @CurrentWorkspace() workspace: Workspace,
    @Args('input') input: CreateServiceAccountWorkspaceMemberInput,
  ): Promise<WorkspaceMember> {
    return await this.workspaceMemberService.createServiceAccount(
      workspace,
      input,
    );
  }

  /**
   * 更新工作区成员信息。
   *
   * @param currentWorkspaceMember - 当前执行操作的工作区成员。
   * @param id - 待更新的工作区成员 ID。
   * @param input - 成员更新参数。
   * @returns 更新后的工作区成员。
   */
  @WorkspaceCan('update', WorkspaceMember)
  @Mutation(() => WorkspaceMember, { nullable: true })
  async updateWorkspaceMember(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateWorkspaceMemberInput,
  ): Promise<WorkspaceMember | null> {
    const member = await this.workspaceMemberService.findOneOrFail({
      id,
      workspace,
    });

    if (
      member.roles.includes('owner') &&
      !currentWorkspaceMember.roles.includes('owner')
    ) {
      throw new ForbiddenException(
        'Only workspace owners can update owner members',
      );
    }
    return await this.workspaceMemberService.updateWorkspaceMember(
      member,
      input,
    );
  }

  /** Replaces roles assigned to a non-owner workspace member. */
  @WorkspaceCan('update', WorkspaceMember)
  @Mutation(() => WorkspaceMember)
  async updateWorkspaceMemberRole(
    @CurrentWorkspace() workspace: Workspace,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateWorkspaceMemberRoleInput,
  ): Promise<WorkspaceMember> {
    const member = await this.workspaceMemberService.findOneOrFail({
      id,
      workspace,
    });
    return (await this.workspaceService.updateMemberRole(
      member,
      input.roles,
    )) as WorkspaceMember;
  }

  /** Replaces direct permissions assigned to a workspace member. */
  @WorkspaceCan('update', WorkspaceMember)
  @Mutation(() => WorkspaceMember)
  async setWorkspaceMemberPermissions(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: SetWorkspaceMemberPermissionsInput,
  ): Promise<WorkspaceMember> {
    if (!currentWorkspaceMember.roles.includes('owner')) {
      throw new ForbiddenException(
        'Only workspace owners can update direct permissions',
      );
    }
    const member = await this.workspaceMemberService.findOneOrFail({
      id,
      workspace,
    });
    return (await this.workspaceService.setMemberPermissions(
      member,
      input.permissions,
    )) as WorkspaceMember;
  }

  /**
   * 移除工作区成员。
   *
   * @param workspaceMember - 当前执行操作的工作区成员。
   * @param id - 待移除的工作区成员 ID。
   * @returns 被移除的工作区成员。
   */
  @WorkspaceCan('delete', WorkspaceMember)
  @Mutation(() => WorkspaceMember)
  async removeWorkspaceMember(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() workspaceMember: WorkspaceMember,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WorkspaceMember> {
    const member = await this.workspaceMemberService.findOneOrFail({
      id,
      workspace,
    });

    if (member.id === workspaceMember.id) {
      throw new ForbiddenException('You are not allowed to remove yourself');
    }

    return await this.workspaceMemberService.remove(member);
  }

  /**
   * 解析工作区成员绑定的用户。
   *
   * @param workspaceMember - 父级工作区成员。
   * @returns 绑定用户，不存在时返回 null。
   */
  @WorkspaceCan('read', User)
  @ResolveField(() => User, { nullable: true })
  async user(@Parent() workspaceMember: WorkspaceMember): Promise<User | null> {
    if (!workspaceMember.user || !workspaceMember.user.id) {
      return null;
    }

    return (await workspaceMember.user.loadOrFail()) ?? null;
  }
}
