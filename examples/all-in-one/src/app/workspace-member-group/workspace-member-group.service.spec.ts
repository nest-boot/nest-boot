vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nest-boot/logger';
import { BadRequestException } from '@nestjs/common';

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service.js';
import { WorkspaceMemberPermission } from '../workspace-member/workspace-member-permission.enum.js';
import { WorkspaceMemberGroupMember } from '../workspace-member-group-member/workspace-member-group-member.entity.js';
import { WorkspaceMemberGroup } from './workspace-member-group.entity.js';
import { WorkspaceMemberGroupService } from './workspace-member-group.service.js';

describe('WorkspaceMemberGroupService', () => {
  it('rejects duplicate group names in the same workspace', async () => {
    const { service, logger } = createService();
    vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'group_1' } as never);

    await expect(
      service.createWorkspaceMemberGroup({ id: 'workspace_1' } as Workspace, {
        name: 'Admins',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(logger.warn).toHaveBeenCalledWith('成员组名称已存在', {
      name: 'Admins',
    });
  });

  it('creates a group without members', async () => {
    const { service, em, logger } = createService();
    const workspace = { id: 'workspace_1' } as Workspace;
    const group = { id: 'group_1', name: 'Admins', workspace };
    vi.spyOn(service, 'findOne').mockResolvedValue(null as never);
    em.create.mockReturnValue(group);

    await expect(
      service.createWorkspaceMemberGroup(workspace, {
        name: 'Admins',
        description: 'Workspace admins',
        permissions: [WorkspaceMemberPermission.MANAGE_MEMBERS],
      }),
    ).resolves.toBe(group);

    expect(em.create).toHaveBeenCalledWith(WorkspaceMemberGroup, {
      name: 'Admins',
      description: 'Workspace admins',
      permissions: [WorkspaceMemberPermission.MANAGE_MEMBERS],
      workspace,
    });
    expect(em.persist).toHaveBeenCalledWith(group);
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('成员组创建成功', {
      groupId: 'group_1',
    });
  });

  it('rejects group creation when requested members are outside the workspace', async () => {
    const { service, em, logger } = createService();
    vi.spyOn(service, 'findOne').mockResolvedValue(null as never);
    em.create.mockReturnValue({ id: 'group_1' });
    em.find.mockResolvedValue([{ id: 'member_1' }]);

    await expect(
      service.createWorkspaceMemberGroup({ id: 'workspace_1' } as Workspace, {
        name: 'Admins',
        memberIds: ['member_1', 'member_2'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(logger.warn).toHaveBeenCalledWith(
      '部分成员不存在或不属于该工作空间',
      {
        requested: 2,
        found: 1,
      },
    );
  });

  it('creates group member relations when member ids are provided', async () => {
    const { service, em, logger } = createService();
    const workspace = { id: 'workspace_1' } as Workspace;
    const member = { id: 'member_1' } as WorkspaceMember;
    vi.spyOn(service, 'findOne').mockResolvedValue(null as never);
    em.create.mockImplementation(
      (entity: unknown, data: Record<string, unknown>) => ({
        entity,
        ...data,
      }),
    );
    em.find.mockResolvedValue([member]);

    await expect(
      service.createWorkspaceMemberGroup(workspace, {
        name: 'Admins',
        memberIds: ['member_1'],
      }),
    ).resolves.toMatchObject({
      entity: WorkspaceMemberGroup,
      name: 'Admins',
    });

    expect(em.find).toHaveBeenCalledWith(WorkspaceMember, {
      id: { $in: ['member_1'] },
      workspace,
    });
    expect(em.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: WorkspaceMemberGroupMember,
        workspace,
        member,
      }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      '成员组创建成功并添加成员',
      expect.objectContaining({ memberCount: 1 }),
    );
  });

  it('rejects renaming a group to an existing group name', async () => {
    const { service, logger } = createService();
    const workspace = { id: 'workspace_1' } as Workspace;
    const group = {
      id: 'group_1',
      name: 'Admins',
      workspace: {
        loadOrFail: vi.fn(async () => workspace),
      },
    } as unknown as WorkspaceMemberGroup;
    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 'group_2',
    } as never);

    await expect(
      service.updateWorkspaceMemberGroup(group, { name: 'Operators' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(logger.warn).toHaveBeenCalledWith('成员组名称已存在', {
      name: 'Operators',
    });
  });

  it('updates a group when the target name is not used by another group', async () => {
    const { service, logger } = createService();
    const group = {
      id: 'group_1',
      name: 'Admins',
      workspace: {
        loadOrFail: vi.fn(async () => ({ id: 'workspace_1' })),
      },
    } as unknown as WorkspaceMemberGroup;
    vi.spyOn(service, 'findOne').mockResolvedValue(null as never);
    const updateSpy = vi
      .spyOn(service, 'update')
      .mockResolvedValue(group as never);

    await expect(
      service.updateWorkspaceMemberGroup(group, { name: 'Operators' }),
    ).resolves.toBe(group);

    expect(updateSpy).toHaveBeenCalledWith(group, { name: 'Operators' });
    expect(logger.log).toHaveBeenCalledWith('成员组更新成功');
  });

  it('adds members with conflict-safe upserts', async () => {
    const { service, em, workspaceMemberService } = createService();
    const workspace = { id: 'workspace_1' } as Workspace;
    const group = {
      id: 'group_1',
      workspace,
    } as unknown as WorkspaceMemberGroup;
    const member = { id: 'member_1' } as WorkspaceMember;
    vi.spyOn(service, 'findOneOrFail').mockResolvedValue(group as never);
    workspaceMemberService.findOneOrFail.mockResolvedValue(member);

    await expect(service.addMembers('group_1', ['member_1'])).resolves.toBe(
      group,
    );

    expect(em.upsertMany).toHaveBeenCalledWith(
      WorkspaceMemberGroupMember,
      [
        expect.objectContaining({
          id: expect.any(String),
          workspace,
          group,
          member,
        }),
      ],
      {
        onConflictAction: 'ignore',
        onConflictFields: ['group', 'member'],
      },
    );
  });

  it('removes group member relations', async () => {
    const { service, em, workspaceMemberService } = createService();
    const group = { id: 'group_1' } as WorkspaceMemberGroup;
    const member = { id: 'member_1' } as WorkspaceMember;
    vi.spyOn(service, 'findOneOrFail').mockResolvedValue(group as never);
    workspaceMemberService.findOneOrFail.mockResolvedValue(member);

    await expect(service.removeMembers('group_1', ['member_1'])).resolves.toBe(
      group,
    );

    expect(em.nativeDelete).toHaveBeenCalledWith(WorkspaceMemberGroupMember, {
      group,
      member: { $in: [member] },
    });
  });
});

function createService() {
  let em: {
    create: Mock;
    persist: Mock;
    flush: Mock;
    find: Mock;
    upsertMany: Mock;
    nativeDelete: Mock;
  };

  em = {
    create: vi.fn((_entity, data) => data),
    persist: vi.fn(() => em),
    flush: vi.fn(),
    find: vi.fn(async () => []),
    upsertMany: vi.fn(),
    nativeDelete: vi.fn(),
  };
  const logger = {
    setContext: vi.fn(),
    assign: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  };
  const workspaceMemberService = {
    findOneOrFail: vi.fn(),
  };
  const service = new WorkspaceMemberGroupService(
    em as unknown as EntityManager,
    logger as unknown as Logger,
    workspaceMemberService as unknown as WorkspaceMemberService,
  );

  return {
    service,
    em,
    logger,
    workspaceMemberService,
  };
}
