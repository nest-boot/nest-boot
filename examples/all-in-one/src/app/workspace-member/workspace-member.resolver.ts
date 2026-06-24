import { CurrentUser } from '@nest-boot/auth';
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
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator.js';
import { CurrentWorkspaceMember } from '../../common/decorators/current-workspace-member.decorator.js';
import { User } from '../user/user.entity.js';
import { UserService } from '../user/user.service.js';
import { Workspace } from '../workspace/workspace.entity.js';
import {
  WorkspaceMemberGroupConnection,
  WorkspaceMemberGroupConnectionArgs,
} from '../workspace-member-group/workspace-member-group.connection-definition.js';
import { WorkspaceMemberGroup } from '../workspace-member-group/workspace-member-group.entity.js';
import { WorkspaceMemberRole } from './enums/workspace-member-role.enum.js';
import { AcceptWorkspaceInviteInput } from './inputs/accept-workspace-invite.input.js';
import { AddWorkspaceMemberInput } from './inputs/add-workspace-member.input.js';
import { CreateServiceAccountWorkspaceMemberInput } from './inputs/create-service-account-workspace-member.input.js';
import { CreateWorkspaceInviteInput } from './inputs/create-workspace-invite.input.js';
import { UpdateWorkspaceMemberInput } from './inputs/update-workspace-member.input.js';
import { AcceptWorkspaceInviteResult } from './types/accept-workspace-invite-result.type.js';
import {
  WorkspaceMemberConnection,
  WorkspaceMemberConnectionArgs,
} from './workspace-member.connection-definition.js';
import { WorkspaceMember } from './workspace-member.entity.js';
import { WorkspaceMemberService } from './workspace-member.service.js';
import { WorkspaceMemberPermission } from './workspace-member-permission.enum.js';

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
  @Can(PermissionAction.READ, WorkspaceMember)
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
  @Can(PermissionAction.READ, WorkspaceMember)
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
  @Can(PermissionAction.READ, WorkspaceMember)
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
   * 根据邀请令牌查询待接受的工作区成员邀请。
   *
   * @param token - 工作区邀请令牌。
   * @returns 匹配的邀请成员。
   */
  @Can(PermissionAction.READ, WorkspaceMember)
  @Query(() => WorkspaceMember, { nullable: true })
  async workspaceMemberByToken(
    @Args('token', { type: () => String }) token: string,
  ): Promise<WorkspaceMember | null> {
    const member =
      await this.workspaceMemberService.findWorkspaceInviteByToken(token);

    // 如果搜不到邀请信息，则说明两种情况：
    // 1. 邀请链接不存在；2. user_id 已经不为空且不等于当前用户，被 RLS 过滤掉了
    // 此时直接视为邀请链接已被使用或已过期
    if (!member) {
      throw new BadRequestException('邀请链接已被使用或已过期');
    }

    return member;
  }

  /**
   * 通过邮箱直接添加已有用户为工作区成员。
   *
   * @param workspace - 当前工作区。
   * @param workspaceMember - 当前执行操作的工作区成员。
   * @param input - 添加成员输入参数。
   * @returns 新创建的工作区成员。
   */
  @Can(PermissionAction.CREATE, WorkspaceMember)
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
  @Can(PermissionAction.CREATE, WorkspaceMember)
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
  @Can(PermissionAction.UPDATE, WorkspaceMember)
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
  @Can(PermissionAction.DELETE, WorkspaceMember)
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
   * 创建工作区邀请。
   *
   * @param currentWorkspace - 当前工作区。
   * @param currentWorkspaceMember - 当前执行操作的工作区成员。
   * @param input - 工作区邀请创建参数。
   * @returns 待接受邀请的工作区成员。
   */
  @Can(PermissionAction.CREATE, WorkspaceMember)
  @Mutation(() => WorkspaceMember)
  async createWorkspaceInvite(
    @CurrentWorkspace() currentWorkspace: Workspace,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
    @Args('input') input: CreateWorkspaceInviteInput,
  ): Promise<WorkspaceMember> {
    // 只有管理员和所有者可以创建邀请
    if (
      ![WorkspaceMemberRole.ADMIN, WorkspaceMemberRole.OWNER].includes(
        currentWorkspaceMember?.role,
      )
    ) {
      throw new ForbiddenException('You are not allowed to create invites');
    }

    return await this.workspaceMemberService.createWorkspaceInvite(
      currentWorkspaceMember,
      currentWorkspace,
      input,
    );
  }

  /**
   * 接受工作区邀请。
   *
   * @param token - 工作区邀请令牌。
   * @param input - 接受邀请时补充的成员信息。
   * @param currentUser - 当前登录用户。
   * @returns 接受邀请后的成员和工作区信息。
   */
  @Can(PermissionAction.UPDATE, WorkspaceMember)
  @Mutation(() => AcceptWorkspaceInviteResult)
  async acceptWorkspaceInvite(
    @Args('token', { type: () => String }) token: string,
    @Args('input', { type: () => AcceptWorkspaceInviteInput, nullable: true })
    input: AcceptWorkspaceInviteInput | null,
    @CurrentUser() currentUser: User,
  ): Promise<AcceptWorkspaceInviteResult> {
    const result =
      await this.workspaceMemberService.acceptWorkspaceInviteByToken(
        currentUser,
        token,
        input,
      );

    if (!result) {
      throw new NotFoundException('邀请链接无效或已过期');
    }

    return result;
  }

  /**
   * 解析工作区成员绑定的用户。
   *
   * @param workspaceMember - 父级工作区成员。
   * @returns 绑定用户，不存在时返回 null。
   */
  @Can(PermissionAction.READ, User)
  @ResolveField(() => User, { nullable: true })
  async user(@Parent() workspaceMember: WorkspaceMember): Promise<User | null> {
    if (!workspaceMember.user || !workspaceMember.user.id) {
      return null;
    }

    return (await workspaceMember.user.loadOrFail()) ?? null;
  }

  /**
   * 解析工作区成员邀请者。
   *
   * @param workspaceMember - 父级工作区成员。
   * @returns 邀请者用户，不存在或名称不可用时返回 null。
   */
  @Can(PermissionAction.READ, User)
  @ResolveField(() => User, { nullable: true })
  async invitedBy(
    @Parent() workspaceMember: WorkspaceMember,
  ): Promise<User | null> {
    if (!workspaceMember.invitedBy || !workspaceMember.invitedBy.id) {
      return null;
    }

    try {
      const user = await workspaceMember.invitedBy.loadOrFail();
      // 如果 user 存在但 name 为 null，返回 null，让前端使用 invitedByUserName
      if (!user.name) {
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }

  /**
   * 分页解析工作区成员所属的成员组。
   *
   * @param workspaceMember - 父级工作区成员。
   * @param args - 分页、筛选和排序参数。
   * @returns 工作区成员组分页结果。
   */
  @Can(PermissionAction.READ, WorkspaceMemberGroup)
  @ResolveField(() => WorkspaceMemberGroupConnection)
  async groups(
    @Parent() workspaceMember: WorkspaceMember,
    @Args() args: WorkspaceMemberGroupConnectionArgs,
  ): Promise<WorkspaceMemberGroupConnection> {
    return await this.cm.find(WorkspaceMemberGroupConnection, args, {
      where: {
        groupMembers: {
          member: workspaceMember,
        },
      },
    });
  }

  /**
   * 解析工作区成员的有效权限。
   *
   * @param workspaceMember - 父级工作区成员。
   * @returns 合并成员直接权限和成员组权限后的去重权限列表。
   */
  @Can(PermissionAction.READ, WorkspaceMember)
  @ResolveField(() => [WorkspaceMemberPermission])
  async effectivePermissions(
    @Parent() workspaceMember: WorkspaceMember,
  ): Promise<WorkspaceMemberPermission[]> {
    return await this.workspaceMemberService.getPermissions(workspaceMember);
  }
}
