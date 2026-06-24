import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nest-boot/logger';
import { EntityService, IdOrEntity } from '@nest-boot/mikro-orm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Sonyflake } from 'sonyflake-js';

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service.js';
import { WorkspaceMemberGroupMember } from '../workspace-member-group-member/workspace-member-group-member.entity.js';
import { CreateWorkspaceMemberGroupInput } from './inputs/create-workspace-member-group.input.js';
import { UpdateWorkspaceMemberGroupInput } from './inputs/update-workspace-member-group.input.js';
import { WorkspaceMemberGroup } from './workspace-member-group.entity.js';

/** 工作区成员组领域服务。 */
@Injectable()
export class WorkspaceMemberGroupService extends EntityService<WorkspaceMemberGroup> {
  /**
   * 创建工作区成员组服务。
   *
   * @param em - MikroORM 实体管理器。
   * @param logger - 结构化日志记录器。
   * @param workspaceMemberService - 工作区成员查询服务。
   */
  constructor(
    /** MikroORM 实体管理器。 */
    protected readonly em: EntityManager,
    /** 结构化日志记录器。 */
    private readonly logger: Logger,
    /** 工作区成员查询服务。 */
    private readonly workspaceMemberService: WorkspaceMemberService,
  ) {
    super(WorkspaceMemberGroup, em);
    this.logger.setContext(WorkspaceMemberGroupService.name);
  }

  /**
   * 创建工作区成员组，并可选地批量加入成员。
   *
   * @param workspace - 成员组所属工作区。
   * @param input - 成员组创建参数。
   * @returns 创建完成的工作区成员组。
   */
  async createWorkspaceMemberGroup(
    workspace: Workspace,
    input: CreateWorkspaceMemberGroupInput,
  ): Promise<WorkspaceMemberGroup> {
    this.logger.assign({ workspaceId: workspace.id, name: input.name });

    // 检查名称是否已存在
    const existing = await this.findOne({
      name: input.name,
      workspace,
    });

    if (existing) {
      this.logger.warn('成员组名称已存在', { name: input.name });
      throw new BadRequestException('成员组名称已存在');
    }

    const group = this.em.create(WorkspaceMemberGroup, {
      name: input.name,
      description: input.description,
      permissions: input.permissions ?? [],
      workspace,
    });

    await this.em.persist(group).flush();

    // 如果提供了 memberIds，添加成员到组
    if (input.memberIds && input.memberIds.length > 0) {
      // 验证所有成员是否属于该工作空间
      const members = await this.em.find(WorkspaceMember, {
        id: { $in: input.memberIds },
        workspace,
      });

      if (members.length !== input.memberIds.length) {
        this.logger.warn('部分成员不存在或不属于该工作空间', {
          requested: input.memberIds.length,
          found: members.length,
        });
        throw new BadRequestException('部分成员不存在或不属于该工作空间');
      }

      // 创建成员组关联
      for (const member of members) {
        const groupMember = this.em.create(WorkspaceMemberGroupMember, {
          workspace,
          group,
          member,
        });
        this.em.persist(groupMember);
      }

      await this.em.flush();
      this.logger.log('成员组创建成功并添加成员', {
        groupId: group.id,
        memberCount: members.length,
      });
    } else {
      this.logger.log('成员组创建成功', { groupId: group.id });
    }

    return group;
  }

  /**
   * 更新工作区成员组信息。
   *
   * @param group - 待更新的工作区成员组。
   * @param input - 成员组更新参数。
   * @returns 更新后的工作区成员组。
   */
  async updateWorkspaceMemberGroup(
    group: WorkspaceMemberGroup,
    input: UpdateWorkspaceMemberGroupInput,
  ): Promise<WorkspaceMemberGroup> {
    this.logger.assign({ groupId: group.id });

    // 如果更新名称，检查名称是否已存在
    if (input.name && input.name !== group.name) {
      const workspace = await group.workspace.loadOrFail();
      const existing = await this.findOne({
        name: input.name,
        workspace,
      });

      if (existing && existing.id !== group.id) {
        this.logger.warn('成员组名称已存在', { name: input.name });
        throw new BadRequestException('成员组名称已存在');
      }
    }

    const updated = await this.update(group, input);

    this.logger.log('成员组更新成功');

    return updated;
  }

  /**
   * 向成员组添加成员。
   *
   * @param idOrEntity - 成员组 ID 或实体。
   * @param memberIdsOrEntities - 待加入的成员 ID 或实体列表。
   * @returns 已添加成员后的成员组。
   */
  async addMembers(
    idOrEntity: IdOrEntity<WorkspaceMemberGroup>,
    memberIdsOrEntities: IdOrEntity<WorkspaceMember>[],
  ): Promise<WorkspaceMemberGroup> {
    const [group, ...members] = await Promise.all([
      this.findOneOrFail(idOrEntity),
      ...memberIdsOrEntities.map((memberIdOrEntity) =>
        this.workspaceMemberService.findOneOrFail(memberIdOrEntity),
      ),
    ]);

    await this.em.upsertMany(
      WorkspaceMemberGroupMember,
      members.map((member) => ({
        id: Sonyflake.next().toString(),
        workspace: group.workspace,
        group,
        member,
      })),
      {
        onConflictAction: 'ignore',
        onConflictFields: ['group', 'member'],
      },
    );

    return group;
  }

  /**
   * 从成员组移除成员。
   *
   * @param idOrEntity - 成员组 ID 或实体。
   * @param memberIdsOrEntities - 待移除的成员 ID 或实体列表。
   * @returns 已移除成员后的成员组。
   */
  async removeMembers(
    idOrEntity: IdOrEntity<WorkspaceMemberGroup>,
    memberIdsOrEntities: IdOrEntity<WorkspaceMember>[],
  ): Promise<WorkspaceMemberGroup> {
    const [group, ...members] = await Promise.all([
      this.findOneOrFail(idOrEntity),
      ...memberIdsOrEntities.map((memberIdOrEntity) =>
        this.workspaceMemberService.findOneOrFail(memberIdOrEntity),
      ),
    ]);

    await this.em.nativeDelete(WorkspaceMemberGroupMember, {
      group,
      member: { $in: members },
    });

    return group;
  }
}
