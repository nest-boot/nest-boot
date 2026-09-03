vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
}));

import { EntityManager } from '@mikro-orm/core';
import type { WorkspaceService } from '@nest-boot/auth';
import { Logger } from '@nest-boot/logger';
import { BadRequestException } from '@nestjs/common';

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberStatus } from './enums/workspace-member-status.enum.js';
import { WorkspaceMemberType } from './enums/workspace-member-type.enum.js';
import { WorkspaceMember } from './workspace-member.entity.js';
import { WorkspaceMemberService } from './workspace-member.service.js';

describe('WorkspaceMemberService', () => {
  it('creates active service account members with default member role', async () => {
    const { service } = createService();
    const workspace = { id: 'workspace_1' } as Workspace;
    const serviceAccount = { id: 'member_1' } as WorkspaceMember;
    const createSpy = vi
      .spyOn(service, 'create')
      .mockResolvedValue(serviceAccount as never);

    await expect(
      service.createServiceAccount(workspace, {
        name: 'Deploy Bot',
      }),
    ).resolves.toBe(serviceAccount);

    expect(createSpy).toHaveBeenCalledWith({
      name: 'Deploy Bot',
      workspace,
      roles: ['member'],
      permissions: [],
      type: WorkspaceMemberType.SERVICE_ACCOUNT,
      user: null,
      email: null,
      status: WorkspaceMemberStatus.ACTIVE,
    });
  });

  it('rejects duplicate emails in the same workspace when updating members', async () => {
    const { service, em } = createService();
    const workspace = { id: 'workspace_1' } as Workspace;
    const member = {
      id: 'member_1',
      workspace: {
        loadOrFail: vi.fn(async () => workspace),
      },
    } as unknown as WorkspaceMember;
    em.find.mockResolvedValue([{ id: 'member_2' }]);

    await expect(
      service.updateWorkspaceMember(member, {
        email: 'duplicate@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects service-account roles outside the configured catalog', async () => {
    const { service } = createService();

    await expect(
      service.createServiceAccount({ id: 'workspace_1' } as Workspace, {
        name: 'Deploy Bot',
        roles: ['missing'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates allowed fields and active-disabled status transitions', async () => {
    const { service, em } = createService();
    const member = {
      id: 'member_1',
      name: 'Old',
      status: WorkspaceMemberStatus.ACTIVE,
    } as WorkspaceMember;

    await expect(
      service.updateWorkspaceMember(member, {
        name: 'New',
        status: WorkspaceMemberStatus.DISABLED,
      }),
    ).resolves.toBe(member);

    expect(member).toMatchObject({
      name: 'New',
      status: WorkspaceMemberStatus.DISABLED,
    });
    expect(em.flush).toHaveBeenCalledTimes(1);
  });
});

function createService() {
  const em = {
    find: vi.fn(async () => []),
    flush: vi.fn(),
  };
  const logger = {
    setContext: vi.fn(),
  };
  const workspaceService = {
    listRoles: vi.fn(() => [
      { name: 'admin', permissions: [] },
      { name: 'member', permissions: [] },
      { name: 'owner', permissions: [] },
    ]),
  };
  const service = new WorkspaceMemberService(
    em as unknown as EntityManager,
    logger as unknown as Logger,
    workspaceService as unknown as WorkspaceService,
  );

  return { service, em, logger };
}
