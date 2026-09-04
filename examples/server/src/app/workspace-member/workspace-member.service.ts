import { EntityManager } from '@mikro-orm/core';
import { WorkspaceService } from '@nest-boot/auth';
import { Logger } from '@nest-boot/logger';
import { EntityService } from '@nest-boot/mikro-orm';
import { BadRequestException, Injectable } from '@nestjs/common';

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberStatus } from './enums/workspace-member-status.enum.js';
import { WorkspaceMemberType } from './enums/workspace-member-type.enum.js';
import { CreateServiceAccountWorkspaceMemberInput } from './inputs/create-service-account-workspace-member.input.js';
import { UpdateWorkspaceMemberInput } from './inputs/update-workspace-member.input.js';
import { WorkspaceMember } from './workspace-member.entity.js';

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
    /** Auth-owned workspace role catalog. */
    private readonly workspaceService: WorkspaceService,
  ) {
    super(WorkspaceMember, em);
    this.logger.setContext(WorkspaceMemberService.name);
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
    const roles = input.roles ?? ['member'];
    if (roles.includes('owner')) {
      throw new BadRequestException(
        'The owner role can only be assigned by transferring ownership',
      );
    }
    const knownRoles = new Set(
      this.workspaceService.listRoles().map((role) => role.name),
    );
    const unknownRoles = roles.filter((role) => !knownRoles.has(role));
    if (unknownRoles.length > 0) {
      throw new BadRequestException(
        `Unknown roles: ${unknownRoles.join(', ')}`,
      );
    }

    return await this.create({
      name: input.name,
      workspace,
      roles,
      permissions: input.permissions ?? [],
      type: WorkspaceMemberType.SERVICE_ACCOUNT,
      user: null,
      email: null,
      status: WorkspaceMemberStatus.ACTIVE,
    });
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
    }

    Object.entries(input).forEach(([key, value]) => {
      if (key !== 'status' && value !== undefined && key in member) {
        (member as unknown as Record<string, unknown>)[key] = value;
      }
    });

    await this.em.flush();
    return member;
  }
}
