import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nest-boot/logger';
import { EntityService } from '@nest-boot/mikro-orm';
import { RequestContext } from '@nest-boot/request-context';
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from '@nest-boot/row-level-security';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import dayjs from 'dayjs';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberGroup } from '../workspace-member-group/workspace-member-group.entity.js';
import { WorkspaceMemberRole } from './enums/workspace-member-role.enum.js';
import { WorkspaceMemberStatus } from './enums/workspace-member-status.enum.js';
import { WorkspaceMemberType } from './enums/workspace-member-type.enum.js';
import { AcceptWorkspaceInviteInput } from './inputs/accept-workspace-invite.input.js';
import { CreateServiceAccountWorkspaceMemberInput } from './inputs/create-service-account-workspace-member.input.js';
import { CreateWorkspaceInviteInput } from './inputs/create-workspace-invite.input.js';
import { UpdateWorkspaceMemberInput } from './inputs/update-workspace-member.input.js';
import { AcceptWorkspaceInviteResult } from './types/accept-workspace-invite-result.type.js';
import { WorkspaceMember } from './workspace-member.entity.js';
import { WorkspaceMemberPermission } from './workspace-member-permission.enum.js';

/** 工作区成员领域服务。 */
@Injectable()
export class WorkspaceMemberService extends EntityService<WorkspaceMember> {
  /**
   * 创建工作区成员服务。
   *
   * @param em - MikroORM 实体管理器。
   * @param logger - 结构化日志记录器。
   */
  constructor(
    /** MikroORM 实体管理器。 */
    protected readonly em: EntityManager,
    /** 结构化日志记录器。 */
    private readonly logger: Logger,
  ) {
    super(WorkspaceMember, em);
    this.logger.setContext(WorkspaceMemberService.name);
  }

  /**
   * 创建工作区邀请成员。
   *
   * @param currentWorkspaceMember - 当前发起邀请的工作区成员。
   * @param currentWorkspace - 当前工作区。
   * @param input - 创建邀请的输入参数。
   * @returns 待接受邀请的工作区成员。
   */
  async createWorkspaceInvite(
    currentWorkspaceMember: WorkspaceMember,
    currentWorkspace: Workspace,
    input: CreateWorkspaceInviteInput,
  ): Promise<WorkspaceMember> {
    // 生成邀请 token
    const inviteToken = randomBytes(16).toString('hex');

    // 设置过期时间（7 天后）
    const inviteExpiresAt = dayjs().add(7, 'day').toDate();

    // 加载出邀请者信息
    const invitedBy = (await currentWorkspaceMember.user?.loadOrFail()) ?? null;

    if (!invitedBy) {
      throw new ForbiddenException('Invited by user not found');
    }

    // 创建邀请
    return await this.create({
      name: '待接受邀请',
      workspace: currentWorkspace,
      role: input.role,
      email: input.email ?? null,
      invitedBy,
      invitedByUserName: invitedBy.name,
      inviteToken,
      inviteExpiresAt,
      status: WorkspaceMemberStatus.INVITING,
      user: null,
    });
  }

  /**
   * 创建服务账号类型的工作区成员。
   *
   * @param workspace - 服务账号所属工作区。
   * @param input - 服务账号创建参数。
   * @returns 创建完成的服务账号成员。
   */
  async createServiceAccount(
    workspace: Workspace,
    input: CreateServiceAccountWorkspaceMemberInput,
  ): Promise<WorkspaceMember> {
    return await this.create({
      name: input.name,
      workspace,
      role: input.role ?? WorkspaceMemberRole.MEMBER,
      permissions: input.permissions ?? [],
      type: WorkspaceMemberType.SERVICE_ACCOUNT,
      user: null,
      email: null,
      status: WorkspaceMemberStatus.ACTIVE,
    });
  }

  /**
   * 根据邀请令牌查找待接受的工作区邀请。
   *
   * @param inviteToken - 邀请令牌。
   * @returns 匹配的邀请成员，不存在时返回 null。
   */
  async findWorkspaceInviteByToken(
    inviteToken: string,
  ): Promise<WorkspaceMember | null> {
    return await RequestContext.child(() => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);

      return this.findOne({
        inviteToken,
        user: null,
      });
    });
  }

  /**
   * 使用邀请令牌接受工作区邀请。
   *
   * @param currentUser - 当前接受邀请的登录用户。
   * @param inviteToken - 邀请令牌。
   * @param input - 接受邀请时补充的成员信息。
   * @returns 接受邀请后的成员和工作区信息；邀请不存在时返回 null。
   */
  async acceptWorkspaceInviteByToken(
    currentUser: User,
    inviteToken: string,
    input: AcceptWorkspaceInviteInput | null = null,
  ): Promise<AcceptWorkspaceInviteResult | null> {
    const member = await this.findWorkspaceInviteByToken(inviteToken);

    if (!member) {
      return null;
    }

    return await this.acceptWorkspaceInvite(currentUser, member, input);
  }

  /**
   * 接受指定工作区邀请成员。
   *
   * @param currentUser - 当前接受邀请的登录用户。
   * @param member - 待接受邀请的工作区成员。
   * @param input - 接受邀请时补充的成员信息。
   * @returns 接受邀请后的成员和工作区信息。
   */
  async acceptWorkspaceInvite(
    currentUser: User,
    member: WorkspaceMember,
    input: AcceptWorkspaceInviteInput | null = null,
  ): Promise<AcceptWorkspaceInviteResult> {
    // 检查是否过期
    if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
      member.status = WorkspaceMemberStatus.INVITE_EXPIRED;
      throw new BadRequestException('邀请链接已过期');
    }

    // 检查是否已经接受过
    if (member.status === WorkspaceMemberStatus.ACTIVE) {
      throw new BadRequestException('已接受过邀请，此链接已失效');
    }
    // 检查用户是否已经是该工作空间的成员
    const existingMember = await this.findOne({
      user: currentUser,
      workspace: member.workspace,
    });

    if (existingMember) {
      throw new BadRequestException('您已经是该工作空间的成员');
    }

    // 如果邀请者设置了 email，需要核对用户的 email
    if (member.email) {
      if (currentUser.email !== member.email) {
        throw new BadRequestException(
          '邀请链接仅限指定的邮箱地址使用，请使用正确的邮箱账户接受邀请',
        );
      }
    }

    // 更新邀请状态，填充用户信息
    // 如果邀请者没有指定 email，使用用户的 email；如果已指定，保持邀请者指定的 email
    // 如果用户提供了 name，使用用户提供的；否则使用用户的默认 name
    const updatedMember = await RequestContext.child(() => {
      RowLevelSecurity.clear();
      RowLevelSecurity.setRole('authenticated');
      RowLevelSecurity.setContext('user_id', currentUser.id);
      RowLevelSecurity.setContext('workspace_id', member.workspace.id);

      return this.update(member, {
        user: currentUser,
        name: input?.name ?? currentUser.name, // 如果用户提供了 name，使用用户提供的；否则使用用户的默认 name
        email: member.email ?? currentUser.email, // 如果邀请者已指定，保持；否则使用用户的邮箱
        status: WorkspaceMemberStatus.ACTIVE,
        updatedAt: new Date(),
      });
    });

    return {
      workspaceMember: updatedMember,
      workspaceId: updatedMember.workspace.id,
    };
  }

  /**
   * 更新工作区成员资料、角色、权限或状态。
   *
   * @param member - 待更新的工作区成员。
   * @param input - 成员更新参数。
   * @returns 更新后的工作区成员。
   */
  async updateWorkspaceMember(
    member: WorkspaceMember,
    input: UpdateWorkspaceMemberInput,
  ): Promise<WorkspaceMember> {
    // 如果传入了邮箱，检查该工作空间下是否已经有其他成员使用了这个邮箱
    if (
      input.email !== undefined &&
      input.email !== null &&
      input.email !== ''
    ) {
      // 加载工作空间
      const workspace = await member.workspace.loadOrFail();

      // 查询该工作空间下是否有其他成员使用了这个邮箱
      const existingMembers = await this.em.find(WorkspaceMember, {
        email: input.email,
        workspace,
      });

      // 检查是否有其他成员（排除当前正在更新的成员）使用了这个邮箱
      const otherMember = existingMembers.find(
        (m: WorkspaceMember) => m.id !== member.id,
      );

      if (otherMember) {
        throw new BadRequestException('该工作空间下已存在使用此邮箱的成员');
      }
    }

    // 状态更新验证：只允许 ACTIVE <-> DISABLED 的切换
    if (input.status !== undefined) {
      const currentStatus = member.status;
      const newStatus = input.status;

      // 只允许活跃和禁用之间的切换，其他状态变更忽略
      const isValidTransition =
        (currentStatus === WorkspaceMemberStatus.ACTIVE &&
          newStatus === WorkspaceMemberStatus.DISABLED) ||
        (currentStatus === WorkspaceMemberStatus.DISABLED &&
          newStatus === WorkspaceMemberStatus.ACTIVE);

      if (isValidTransition) {
        member.status = newStatus;
      }
      // 其他状态变更直接忽略，不更新状态字段
    }

    // 遍历 member 的可更新字段，从 input 中取对应值更新（排除 status，因为已经单独处理）
    Object.entries(input).forEach(([key, value]) => {
      if (key !== 'status' && value !== undefined && key in member) {
        (member as unknown as Record<string, unknown>)[key] = value;
      }
    });

    // 先修改实体，再 flush
    await this.em.flush();

    return member;
  }

  /**
   * 获取成员的有效权限。
   *
   * @param workspaceMember - 工作区成员。
   * @returns 合并成员直接权限和成员组权限后的去重权限列表。
   */
  async getPermissions(
    workspaceMember: WorkspaceMember,
  ): Promise<WorkspaceMemberPermission[]> {
    // 查询当前成员所在的所有成员组
    const groups = await this.em.find(WorkspaceMemberGroup, {
      groupMembers: {
        member: workspaceMember,
      },
    });

    // 合并成员的权限和组权限，并去重
    return Array.from(
      new Set([
        ...(workspaceMember.permissions ?? []),
        ...groups.flatMap((group) => group.permissions ?? []),
      ]),
    );
  }
}
