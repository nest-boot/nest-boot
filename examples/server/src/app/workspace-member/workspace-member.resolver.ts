import { Can, CurrentWorkspace, CurrentWorkspaceMember } from '@nest-boot/auth';
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
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { User } from '../user/user.entity.js';
import { UserService } from '../user/user.service.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberRole } from './enums/workspace-member-role.enum.js';
import { AddWorkspaceMemberInput } from './inputs/add-workspace-member.input.js';
import { CreateServiceAccountWorkspaceMemberInput } from './inputs/create-service-account-workspace-member.input.js';
import { UpdateWorkspaceMemberInput } from './inputs/update-workspace-member.input.js';
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
   * @param userService - 用户查询服务。
   * @param cm - GraphQL 连接查询管理器。
   */
  constructor(
    /** 工作区成员领域服务。 */
    private readonly workspaceMemberService: WorkspaceMemberService,
    /** 用户查询服务。 */
    private readonly userService: UserService,
    /** GraphQL 连接查询管理器。 */
    private readonly cm: ConnectionManager,
  ) {}

  /**
   * 获取当前请求中的工作区成员。
   *
   * @param workspaceMember - 当前请求上下文中的工作区成员。
   * @returns 当前工作区成员；请求未解析出成员时返回 null。
   */
  @Can('read', WorkspaceMember)
  @Query(() => WorkspaceMember, { nullable: true })
  currentWorkspaceMember(
    @CurrentWorkspaceMember() workspaceMember?: WorkspaceMember,
  ): WorkspaceMember | null {
    return workspaceMember ?? null;
  }

  /**
   * 根据 ID 查询工作区成员。
   *
   * @param id - 工作区成员 ID。
   * @returns 匹配的工作区成员，不存在时返回 null。
   */
  @Can('read', WorkspaceMember)
  @Query(() => WorkspaceMember, { nullable: true })
  async workspaceMember(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WorkspaceMember | null> {
    return await this.workspaceMemberService.findOne({ id });
  }

  /**
   * 分页查询工作区成员。
   *
   * @param args - 分页、筛选和排序参数。
   * @param workspace - 当前请求中的工作区。
   * @param workspaceMember - 当前请求中的工作区成员。
   * @returns 工作区成员分页结果。
   */
  @Can('read', WorkspaceMember)
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
   * @param workspaceMember - 当前执行操作的工作区成员。
   * @param input - 添加成员输入参数。
   * @returns 新创建的工作区成员。
   */
  @Can('create', WorkspaceMember)
  @Mutation(() => WorkspaceMember)
  async addWorkspaceMember(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() workspaceMember: WorkspaceMember,
    @Args('input') input: AddWorkspaceMemberInput,
  ): Promise<WorkspaceMember> {
    // 只有所有者可以添加成员
    if (workspaceMember.role !== WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('You are not allowed to add members');
    }

    const user = await this.userService.findOne({
      email: input.email,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 检查新用户是否已经存在于当前工作空间
    const alreadyExist = await workspace.members.loadCount({
      where: {
        user: {
          id: user.id,
        },
      },
    });

    if (alreadyExist > 0) {
      throw new ForbiddenException('User already exists in the workspace');
    }

    return await this.workspaceMemberService.create({
      name: user.name ?? user.email.split('@')[0],
      user,
      workspace,
    });
  }

  /**
   * 创建服务账号工作区成员。
   *
   * @param workspace - 当前工作区。
   * @param workspaceMember - 当前执行操作的工作区成员。
   * @param input - 服务账号创建参数。
   * @returns 新创建的服务账号成员。
   */
  @Can('create', WorkspaceMember)
  @Mutation(() => WorkspaceMember)
  async createServiceAccountWorkspaceMember(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() workspaceMember: WorkspaceMember,
    @Args('input') input: CreateServiceAccountWorkspaceMemberInput,
  ): Promise<WorkspaceMember> {
    if (
      ![WorkspaceMemberRole.ADMIN, WorkspaceMemberRole.OWNER].includes(
        workspaceMember.role,
      )
    ) {
      throw new ForbiddenException(
        'You are not allowed to create service accounts',
      );
    }

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
  @Can('update', WorkspaceMember)
  @Mutation(() => WorkspaceMember, { nullable: true })
  async updateWorkspaceMember(
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateWorkspaceMemberInput,
  ): Promise<WorkspaceMember | null> {
    // 普通用户不能修改其他成员的角色
    if (currentWorkspaceMember.role === WorkspaceMemberRole.MEMBER) {
      throw new ForbiddenException('You are not allowed to update members');
    }

    const member = await this.workspaceMemberService.findOneOrFail({
      id,
    });

    // 不能修改角色为所有者的成员
    if (
      member.id !== currentWorkspaceMember.id &&
      member.role === WorkspaceMemberRole.OWNER
    ) {
      throw new ForbiddenException(
        'You are not allowed to update other members',
      );
    }

    return await this.workspaceMemberService.updateWorkspaceMember(
      member,
      input,
    );
  }

  /**
   * 移除工作区成员。
   *
   * @param workspaceMember - 当前执行操作的工作区成员。
   * @param id - 待移除的工作区成员 ID。
   * @returns 被移除的工作区成员。
   */
  @Can('delete', WorkspaceMember)
  @Mutation(() => WorkspaceMember)
  async removeWorkspaceMember(
    @CurrentWorkspaceMember() workspaceMember: WorkspaceMember,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WorkspaceMember> {
    if (workspaceMember.role !== WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('You are not allowed to remove members');
    }

    const member = await this.workspaceMemberService.findOneOrFail({ id });

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
  @Can('read', User)
  @ResolveField(() => User, { nullable: true })
  async user(@Parent() workspaceMember: WorkspaceMember): Promise<User | null> {
    if (!workspaceMember.user || !workspaceMember.user.id) {
      return null;
    }

    return (await workspaceMember.user.loadOrFail()) ?? null;
  }
}
