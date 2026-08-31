vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nest-boot/logger';
import { RequestContext } from '@nest-boot/request-context';
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from '@nest-boot/row-level-security';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberGroup } from '../workspace-member-group/workspace-member-group.entity.js';
import { WorkspaceMemberRole } from './enums/workspace-member-role.enum.js';
import { WorkspaceMemberStatus } from './enums/workspace-member-status.enum.js';
import { WorkspaceMemberType } from './enums/workspace-member-type.enum.js';
import { WorkspaceMember } from './workspace-member.entity.js';
import { WorkspaceMemberService } from './workspace-member.service.js';
import { WorkspaceMemberPermission } from './workspace-member-permission.enum.js';

describe('WorkspaceMemberService', () => {
  it('creates an invitation from the current workspace member user', async () => {
    const { service } = createService();
    const workspace = { id: 'workspace_1' } as Workspace;
    const invitedBy = {
      id: 'user_1',
      name: 'Alice',
    } as User;
    const invite = { id: 'invite_1' } as WorkspaceMember;
    const createSpy = vi
      .spyOn(service, 'create')
      .mockResolvedValue(invite as never);

    await expect(
      service.createWorkspaceInvite(
        {
          user: {
            loadOrFail: vi.fn(async () => invitedBy),
          },
        } as unknown as WorkspaceMember,
        workspace,
        {
          email: 'bob@example.com',
          role: WorkspaceMemberRole.ADMIN,
        },
      ),
    ).resolves.toBe(invite);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '待接受邀请',
        workspace,
        role: WorkspaceMemberRole.ADMIN,
        email: 'bob@example.com',
        invitedBy,
        invitedByUserName: 'Alice',
        inviteToken: expect.stringMatching(/^[a-f0-9]{32}$/),
        inviteExpiresAt: expect.any(Date),
        status: WorkspaceMemberStatus.INVITING,
        user: null,
      }),
    );
  });

  it('rejects invitation creation without an inviting user', async () => {
    const { service } = createService();

    await expect(
      service.createWorkspaceInvite(
        {} as WorkspaceMember,
        { id: 'workspace_1' } as Workspace,
        {
          role: WorkspaceMemberRole.MEMBER,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

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
      role: WorkspaceMemberRole.MEMBER,
      permissions: [],
      type: WorkspaceMemberType.SERVICE_ACCOUNT,
      user: null,
      email: null,
      status: WorkspaceMemberStatus.ACTIVE,
    });
  });

  it('returns null when an invite token cannot be found', async () => {
    const { service, em } = createService();
    vi.spyOn(service, 'findOne').mockResolvedValue(null as never);

    await RequestContext.run(new RequestContext({ type: 'test' }), async () => {
      await expect(
        service.findWorkspaceInviteByToken('missing_token'),
      ).resolves.toBeNull();
    });
    expect(em.getConnection).not.toHaveBeenCalled();
  });

  it('loads invitations by token with row-level security disabled only in a child context', async () => {
    const { service, em } = createService();
    const member = { id: 'member_1' } as WorkspaceMember;
    const findOneSpy = vi
      .spyOn(service, 'findOne')
      .mockImplementation(async () => {
        expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);

        return member as never;
      });

    await RequestContext.run(new RequestContext({ type: 'test' }), async () => {
      RowLevelSecurity.setRole('authenticated');
      RowLevelSecurity.setContext('user_id', 'invitee_1');

      await expect(service.findWorkspaceInviteByToken('token_1')).resolves.toBe(
        member,
      );

      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.AUTO);
      expect(RowLevelSecurity.getContext('user_id')).toBe('invitee_1');
    });

    expect(findOneSpy).toHaveBeenCalledWith({
      inviteToken: 'token_1',
      user: null,
    });
    expect(em.getConnection).not.toHaveBeenCalled();
  });

  it('returns null when accepting an invite token that has no invite row', async () => {
    const { service, em } = createService();
    vi.spyOn(service, 'findOne').mockResolvedValue(null as never);

    await RequestContext.run(new RequestContext({ type: 'test' }), async () => {
      await expect(
        service.acceptWorkspaceInviteByToken(
          { id: 'user_1' } as User,
          'missing_token',
        ),
      ).resolves.toBeNull();
    });
    expect(em.getConnection).not.toHaveBeenCalled();
  });

  it('returns null when an invite row cannot be loaded by token', async () => {
    const { service, em } = createService();
    vi.spyOn(service, 'findOne').mockResolvedValue(null as never);

    await RequestContext.run(new RequestContext({ type: 'test' }), async () => {
      await expect(
        service.acceptWorkspaceInviteByToken(
          { id: 'user_1' } as User,
          'token_1',
        ),
      ).resolves.toBeNull();
    });
    expect(em.getConnection).not.toHaveBeenCalled();
  });

  it('accepts invitations after loading them by token policy', async () => {
    const { service, em } = createService();
    const user = { id: 'user_1' } as User;
    const member = { id: 'member_1' } as WorkspaceMember;
    const result = {
      workspaceMember: member,
      workspaceId: 'workspace_1',
    };
    vi.spyOn(service, 'findOne').mockResolvedValue(member as never);
    const acceptSpy = vi
      .spyOn(service, 'acceptWorkspaceInvite')
      .mockResolvedValue(result);

    await RequestContext.run(new RequestContext({ type: 'test' }), async () => {
      await expect(
        service.acceptWorkspaceInviteByToken(user, 'token_1', {
          name: 'Alice',
        }),
      ).resolves.toBe(result);
    });

    expect(acceptSpy).toHaveBeenCalledWith(user, member, {
      name: 'Alice',
    });
    expect(em.getConnection).not.toHaveBeenCalled();
  });

  it('marks expired invitations and rejects them', async () => {
    const { service } = createService();
    const member = {
      inviteExpiresAt: new Date(Date.now() - 1_000),
      status: WorkspaceMemberStatus.INVITING,
    } as WorkspaceMember;

    await expect(
      service.acceptWorkspaceInvite({} as User, member),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(member.status).toBe(WorkspaceMemberStatus.INVITE_EXPIRED);
  });

  it('rejects already accepted invitations', async () => {
    const { service } = createService();

    await expect(
      service.acceptWorkspaceInvite(
        {} as User,
        {
          status: WorkspaceMemberStatus.ACTIVE,
        } as WorkspaceMember,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invitations when the user is already a workspace member', async () => {
    const { service } = createService();
    vi.spyOn(service, 'findOne').mockResolvedValue({} as never);

    await expect(
      service.acceptWorkspaceInvite(
        { id: 'user_1' } as User,
        {
          status: WorkspaceMemberStatus.INVITING,
          workspace: { id: 'workspace_1' },
        } as WorkspaceMember,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invitations restricted to a different email', async () => {
    const { service } = createService();
    vi.spyOn(service, 'findOne').mockResolvedValue(null as never);

    await expect(
      service.acceptWorkspaceInvite(
        { email: 'alice@example.com' } as User,
        {
          email: 'bob@example.com',
          status: WorkspaceMemberStatus.INVITING,
          workspace: { id: 'workspace_1' },
        } as WorkspaceMember,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts invitations and returns the accepted workspace id', async () => {
    const { service } = createService();
    const user = {
      id: 'user_1',
      name: 'Alice',
      email: 'alice@example.com',
    } as User;
    const member = {
      email: null,
      status: WorkspaceMemberStatus.INVITING,
      workspace: { id: 'workspace_1' },
    } as WorkspaceMember;
    const updatedMember = {
      ...member,
      name: 'Accepted Name',
      workspace: { id: 'workspace_1' },
    } as WorkspaceMember;
    vi.spyOn(service, 'findOne').mockResolvedValue(null as never);
    const updateSpy = vi
      .spyOn(service, 'update')
      .mockImplementation(async () => {
        expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.AUTO);
        expect(RowLevelSecurity.getRole()).toBe('authenticated');
        expect(RowLevelSecurity.getContext('user_id')).toBe('user_1');
        expect(RowLevelSecurity.getContext('workspace_id')).toBe('workspace_1');

        return updatedMember as never;
      });

    await RequestContext.run(new RequestContext({ type: 'test' }), async () => {
      RowLevelSecurity.setRole('authenticated');
      RowLevelSecurity.setContext('user_id', 'user_1');

      await expect(
        service.acceptWorkspaceInvite(user, member, { name: 'Accepted Name' }),
      ).resolves.toEqual({
        workspaceMember: updatedMember,
        workspaceId: 'workspace_1',
      });

      expect(RowLevelSecurity.getContext('workspace_id')).toBeUndefined();
    });

    expect(updateSpy).toHaveBeenCalledWith(
      member,
      expect.objectContaining({
        user,
        name: 'Accepted Name',
        email: 'alice@example.com',
        status: WorkspaceMemberStatus.ACTIVE,
        updatedAt: expect.any(Date),
      }),
    );
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

  it('updates allowed fields and valid active-disabled status transitions', async () => {
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

  it('ignores invalid status transitions when updating members', async () => {
    const { service, em } = createService();
    const member = {
      id: 'member_1',
      status: WorkspaceMemberStatus.INVITING,
    } as WorkspaceMember;

    await service.updateWorkspaceMember(member, {
      status: WorkspaceMemberStatus.ACTIVE,
    });

    expect(member.status).toBe(WorkspaceMemberStatus.INVITING);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it('merges direct and group permissions without duplicates', async () => {
    const { service, em } = createService();
    const member = {
      permissions: [
        WorkspaceMemberPermission.MANAGE_WORKSPACE,
        WorkspaceMemberPermission.MANAGE_MEMBERS,
      ],
    } as WorkspaceMember;
    em.find.mockResolvedValue([
      {
        permissions: [
          WorkspaceMemberPermission.MANAGE_MEMBERS,
          WorkspaceMemberPermission.MANAGE_WORKSPACE,
        ],
      } as WorkspaceMemberGroup,
    ]);

    await expect(service.getPermissions(member)).resolves.toEqual([
      WorkspaceMemberPermission.MANAGE_WORKSPACE,
      WorkspaceMemberPermission.MANAGE_MEMBERS,
    ]);
  });

  it('merges group permissions when direct permissions are empty', async () => {
    const { service, em } = createService();
    const member = {} as WorkspaceMember;
    em.find.mockResolvedValue([
      {
        permissions: [WorkspaceMemberPermission.MANAGE_MEMBERS],
      } as WorkspaceMemberGroup,
    ]);

    await expect(service.getPermissions(member)).resolves.toEqual([
      WorkspaceMemberPermission.MANAGE_MEMBERS,
    ]);
  });
});

function createService() {
  const connection = {
    execute: vi.fn(async () => []),
  };
  const em: {
    find: Mock;
    flush: Mock;
    getConnection: Mock;
  } = {
    find: vi.fn(async () => []),
    flush: vi.fn(),
    getConnection: vi.fn(() => connection),
  };
  const logger = {
    setContext: vi.fn(),
  };
  const service = new WorkspaceMemberService(
    em as unknown as EntityManager,
    logger as unknown as Logger,
  );

  return {
    service,
    em,
    logger,
  };
}
