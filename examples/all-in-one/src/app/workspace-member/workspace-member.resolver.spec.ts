import type { Mocked } from 'vitest';
vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
  CurrentUser: () => () => undefined,
}));

vi.mock('@nest-boot/graphql-connection', () => ({
  ConnectionBuilder: class ConnectionBuilder {
    addField() {
      return this;
    }

    build() {
      return {
        Connection: class Connection {},
        ConnectionArgs: class ConnectionArgs {},
      };
    }
  },
  ConnectionManager: class ConnectionManager {},
}));

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { User } from '../user/user.entity.js';
import { UserService } from '../user/user.service.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberGroup } from '../workspace-member-group/workspace-member-group.entity.js';
import { WorkspaceMemberRole } from './enums/workspace-member-role.enum.js';
import { WorkspaceMember } from './workspace-member.entity.js';
import { WorkspaceMemberResolver } from './workspace-member.resolver.js';
import { WorkspaceMemberService } from './workspace-member.service.js';
import { WorkspaceMemberPermission } from './workspace-member-permission.enum.js';

describe('WorkspaceMemberResolver', () => {
  it('returns the current workspace member from request context', () => {
    const { resolver } = createResolver();
    const workspaceMember = { id: 'member_1' } as WorkspaceMember;

    expect(resolver.currentWorkspaceMember(workspaceMember)).toBe(
      workspaceMember,
    );
  });

  it('returns null when no current workspace member is available', () => {
    const { resolver } = createResolver();

    expect(resolver.currentWorkspaceMember()).toBeNull();
  });

  it('rejects listing members without a current workspace member', async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.workspaceMembers({} as never, undefined, undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('filters listed members by current workspace when present', async () => {
    const { resolver, cm } = createResolver();
    const workspace = { id: 'workspace_1' } as Workspace;
    const workspaceMember = { id: 'member_1' } as WorkspaceMember;
    const args = { first: 10 } as never;

    await resolver.workspaceMembers(args, workspace, workspaceMember);

    expect(cm.find).toHaveBeenCalledWith(expect.any(Function), args, {
      where: {
        workspace,
      },
    });
  });

  it('lists members without a workspace filter when only member context is available', async () => {
    const { resolver, cm } = createResolver();
    const args = { first: 10 } as never;

    await resolver.workspaceMembers(args, undefined, {
      id: 'member_1',
    } as WorkspaceMember);

    expect(cm.find).toHaveBeenCalledWith(expect.any(Function), args);
  });

  it('finds a member by id through the service', async () => {
    const member = { id: 'member_1' } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        findOne: vi.fn(async () => member),
      },
    });

    await expect(resolver.workspaceMember('member_1')).resolves.toBe(member);

    expect(workspaceMemberService.findOne).toHaveBeenCalledWith({
      id: 'member_1',
    });
  });

  it('returns a member for a valid invite token', async () => {
    const member = { id: 'member_1' } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        findWorkspaceInviteByToken: vi.fn(async () => member),
      },
    });

    await expect(resolver.workspaceMemberByToken('token_1')).resolves.toBe(
      member,
    );

    expect(
      workspaceMemberService.findWorkspaceInviteByToken,
    ).toHaveBeenCalledWith('token_1');
  });

  it('throws a bad request for consumed or missing invite tokens', async () => {
    const { resolver, workspaceMemberService } = createResolver();
    workspaceMemberService.findWorkspaceInviteByToken.mockResolvedValue(null);

    await expect(
      resolver.workspaceMemberByToken('missing_token'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows owners to add existing users as workspace members', async () => {
    const workspace = {
      id: 'workspace_1',
      members: {
        loadCount: vi.fn(async () => 0),
      },
    } as unknown as Workspace;
    const user = {
      id: 'user_1',
      name: 'Alice',
      email: 'alice@example.com',
    } as User;
    const createdMember = { id: 'member_2' } as WorkspaceMember;
    const { resolver, workspaceMemberService, userService } = createResolver({
      userService: {
        findOne: vi.fn(async () => user),
      },
      workspaceMemberService: {
        create: vi.fn(async () => createdMember),
      },
    });

    await expect(
      resolver.addWorkspaceMember(
        workspace,
        { role: WorkspaceMemberRole.OWNER } as WorkspaceMember,
        { email: 'alice@example.com' },
      ),
    ).resolves.toBe(createdMember);

    expect(userService.findOne).toHaveBeenCalledWith({
      email: 'alice@example.com',
    });
    expect(workspace.members.loadCount).toHaveBeenCalledWith({
      where: {
        user: {
          id: 'user_1',
        },
      },
    });
    expect(workspaceMemberService.create).toHaveBeenCalledWith({
      name: 'Alice',
      user,
      workspace,
    });
  });

  it('rejects adding members by non owners', async () => {
    const { resolver, workspaceMemberService } = createResolver();

    await expect(
      resolver.addWorkspaceMember(
        { id: 'workspace_1' } as Workspace,
        { role: WorkspaceMemberRole.ADMIN } as WorkspaceMember,
        { email: 'alice@example.com' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(workspaceMemberService.create).not.toHaveBeenCalled();
  });

  it('rejects adding users that are not found', async () => {
    const { resolver, userService } = createResolver({
      userService: {
        findOne: vi.fn(async () => null),
      },
    });

    await expect(
      resolver.addWorkspaceMember(
        { id: 'workspace_1' } as Workspace,
        { role: WorkspaceMemberRole.OWNER } as WorkspaceMember,
        { email: 'missing@example.com' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(userService.findOne).toHaveBeenCalledWith({
      email: 'missing@example.com',
    });
  });

  it('rejects adding users already in the workspace', async () => {
    const workspace = {
      members: {
        loadCount: vi.fn(async () => 1),
      },
    } as unknown as Workspace;
    const { resolver } = createResolver({
      userService: {
        findOne: vi.fn(
          async () =>
            ({
              id: 'user_1',
              name: 'Alice',
              email: 'alice@example.com',
            }) as unknown as User,
        ),
      },
    });

    await expect(
      resolver.addWorkspaceMember(
        workspace,
        { role: WorkspaceMemberRole.OWNER } as WorkspaceMember,
        { email: 'alice@example.com' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses email prefix when adding a user without a name', async () => {
    const workspace = {
      members: {
        loadCount: vi.fn(async () => 0),
      },
    } as unknown as Workspace;
    const user = {
      id: 'user_1',
      name: undefined,
      email: 'alice@example.com',
    } as unknown as User;
    const createdMember = { id: 'member_2' } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      userService: {
        findOne: vi.fn(async () => user),
      },
      workspaceMemberService: {
        create: vi.fn(async () => createdMember),
      },
    });

    await expect(
      resolver.addWorkspaceMember(
        workspace,
        { role: WorkspaceMemberRole.OWNER } as WorkspaceMember,
        { email: 'alice@example.com' },
      ),
    ).resolves.toBe(createdMember);

    expect(workspaceMemberService.create).toHaveBeenCalledWith({
      name: 'alice',
      user,
      workspace,
    });
  });

  it('allows admins to create service account members', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const created = { id: 'member_1' } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        createServiceAccount: vi.fn(async () => created),
      },
    });

    await expect(
      resolver.createServiceAccountWorkspaceMember(
        workspace,
        { role: WorkspaceMemberRole.ADMIN } as WorkspaceMember,
        { name: 'Deploy Bot' },
      ),
    ).resolves.toBe(created);

    expect(workspaceMemberService.createServiceAccount).toHaveBeenCalledWith(
      workspace,
      { name: 'Deploy Bot' },
    );
  });

  it('rejects service account creation by regular members', async () => {
    const { resolver, workspaceMemberService } = createResolver();

    await expect(
      resolver.createServiceAccountWorkspaceMember(
        { id: 'workspace_1' } as Workspace,
        { role: WorkspaceMemberRole.MEMBER } as WorkspaceMember,
        { name: 'Deploy Bot' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(workspaceMemberService.createServiceAccount).not.toHaveBeenCalled();
  });

  it('rejects member updates by regular members', async () => {
    const { resolver, workspaceMemberService } = createResolver();

    await expect(
      resolver.updateWorkspaceMember(
        { role: WorkspaceMemberRole.MEMBER } as WorkspaceMember,
        'member_2',
        { name: 'New' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(workspaceMemberService.findOneOrFail).not.toHaveBeenCalled();
  });

  it('rejects updating other owners', async () => {
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        findOneOrFail: vi.fn(
          async () =>
            ({
              id: 'member_2',
              role: WorkspaceMemberRole.OWNER,
            }) as WorkspaceMember,
        ),
      },
    });

    await expect(
      resolver.updateWorkspaceMember(
        {
          id: 'member_1',
          role: WorkspaceMemberRole.ADMIN,
        } as WorkspaceMember,
        'member_2',
        { name: 'New' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(workspaceMemberService.updateWorkspaceMember).not.toHaveBeenCalled();
  });

  it('allows admins to update regular members', async () => {
    const member = {
      id: 'member_2',
      role: WorkspaceMemberRole.MEMBER,
    } as WorkspaceMember;
    const updated = {
      ...member,
      name: 'Alice',
    } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        findOneOrFail: vi.fn(async () => member),
        updateWorkspaceMember: vi.fn(async () => updated),
      },
    });

    await expect(
      resolver.updateWorkspaceMember(
        {
          id: 'member_1',
          role: WorkspaceMemberRole.ADMIN,
        } as WorkspaceMember,
        'member_2',
        { name: 'Alice' },
      ),
    ).resolves.toBe(updated);

    expect(workspaceMemberService.updateWorkspaceMember).toHaveBeenCalledWith(
      member,
      { name: 'Alice' },
    );
  });

  it('allows owners to update their own owner member record', async () => {
    const member = {
      id: 'member_1',
      role: WorkspaceMemberRole.OWNER,
    } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        findOneOrFail: vi.fn(async () => member),
        updateWorkspaceMember: vi.fn(async () => member),
      },
    });

    await expect(
      resolver.updateWorkspaceMember(member, 'member_1', { name: 'Owner' }),
    ).resolves.toBe(member);
  });

  it('rejects member removal by non owners', async () => {
    const { resolver, workspaceMemberService } = createResolver();

    await expect(
      resolver.removeWorkspaceMember(
        {
          id: 'member_1',
          role: WorkspaceMemberRole.ADMIN,
        } as WorkspaceMember,
        'member_2',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(workspaceMemberService.findOneOrFail).not.toHaveBeenCalled();
  });

  it('rejects self removal', async () => {
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        findOneOrFail: vi.fn(
          async () =>
            ({
              id: 'member_1',
            }) as WorkspaceMember,
        ),
      },
    });

    await expect(
      resolver.removeWorkspaceMember(
        {
          id: 'member_1',
          role: WorkspaceMemberRole.OWNER,
        } as WorkspaceMember,
        'member_1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(workspaceMemberService.remove).not.toHaveBeenCalled();
  });

  it('allows owners to remove other members', async () => {
    const member = { id: 'member_2' } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        findOneOrFail: vi.fn(async () => member),
        remove: vi.fn(async () => member),
      },
    });

    await expect(
      resolver.removeWorkspaceMember(
        {
          id: 'member_1',
          role: WorkspaceMemberRole.OWNER,
        } as WorkspaceMember,
        'member_2',
      ),
    ).resolves.toBe(member);

    expect(workspaceMemberService.remove).toHaveBeenCalledWith(member);
  });

  it('allows admins to create workspace invites', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const member = {
      id: 'member_1',
      role: WorkspaceMemberRole.ADMIN,
    } as WorkspaceMember;
    const invitedMember = { id: 'member_2' } as WorkspaceMember;
    const input = {
      email: 'alice@example.com',
      role: WorkspaceMemberRole.MEMBER,
    };
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        createWorkspaceInvite: vi.fn(async () => invitedMember),
      },
    });

    await expect(
      resolver.createWorkspaceInvite(workspace, member, input),
    ).resolves.toBe(invitedMember);

    expect(workspaceMemberService.createWorkspaceInvite).toHaveBeenCalledWith(
      member,
      workspace,
      input,
    );
  });

  it('rejects workspace invite creation by regular members', async () => {
    const { resolver, workspaceMemberService } = createResolver();

    await expect(
      resolver.createWorkspaceInvite(
        { id: 'workspace_1' } as Workspace,
        { role: WorkspaceMemberRole.MEMBER } as WorkspaceMember,
        {
          email: 'alice@example.com',
          role: WorkspaceMemberRole.MEMBER,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(workspaceMemberService.createWorkspaceInvite).not.toHaveBeenCalled();
  });

  it('rejects invitation acceptance when token is missing', async () => {
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        acceptWorkspaceInviteByToken: vi.fn(async () => null),
      },
    });

    await expect(
      resolver.acceptWorkspaceInvite('missing_token', null, {
        id: 'user_1',
      } as User),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates invitation acceptance after resolving the token', async () => {
    const member = { id: 'member_1' } as WorkspaceMember;
    const user = { id: 'user_1' } as User;
    const result = {
      workspaceMember: member,
      workspaceId: 'workspace_1',
    };
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        acceptWorkspaceInviteByToken: vi.fn(async () => result),
      },
    });

    await expect(
      resolver.acceptWorkspaceInvite('token_1', { name: 'Alice' }, user),
    ).resolves.toBe(result);

    expect(
      workspaceMemberService.acceptWorkspaceInviteByToken,
    ).toHaveBeenCalledWith(user, 'token_1', { name: 'Alice' });
  });

  it('returns null user fields when the member has no user reference', async () => {
    const { resolver } = createResolver();

    await expect(resolver.user({} as WorkspaceMember)).resolves.toBeNull();
  });

  it('loads user fields when the member has a user reference', async () => {
    const { resolver } = createResolver();
    const user = { id: 'user_1' } as User;
    const member = {
      user: {
        id: 'user_1',
        loadOrFail: vi.fn(async () => user),
      },
    } as unknown as WorkspaceMember;

    await expect(resolver.user(member)).resolves.toBe(user);
  });

  it('returns null invitedBy fields when no inviter is referenced', async () => {
    const { resolver } = createResolver();

    await expect(resolver.invitedBy({} as WorkspaceMember)).resolves.toBeNull();
  });

  it('returns null invitedBy when the inviter has no name', async () => {
    const { resolver } = createResolver();
    const member = {
      invitedBy: {
        id: 'user_1',
        loadOrFail: vi.fn(async () => ({ id: 'user_1', name: '' })),
      },
    } as unknown as WorkspaceMember;

    await expect(resolver.invitedBy(member)).resolves.toBeNull();
  });

  it('returns invitedBy user when it can be loaded', async () => {
    const { resolver } = createResolver();
    const user = { id: 'user_1', name: 'Alice' } as User;
    const member = {
      invitedBy: {
        id: 'user_1',
        loadOrFail: vi.fn(async () => user),
      },
    } as unknown as WorkspaceMember;

    await expect(resolver.invitedBy(member)).resolves.toBe(user);
  });

  it('returns null invitedBy when loading fails', async () => {
    const { resolver } = createResolver();
    const member = {
      invitedBy: {
        id: 'user_1',
        loadOrFail: vi.fn(async () => {
          throw new Error('missing');
        }),
      },
    } as unknown as WorkspaceMember;

    await expect(resolver.invitedBy(member)).resolves.toBeNull();
  });

  it('loads effective permissions through the service', async () => {
    const permissions = [WorkspaceMemberPermission.MANAGE_MEMBERS];
    const workspaceMember = { id: 'member_1' } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        getPermissions: vi.fn(async () => permissions),
      },
    });

    await expect(
      resolver.effectivePermissions(workspaceMember),
    ).resolves.toEqual(permissions);

    expect(workspaceMemberService.getPermissions).toHaveBeenCalledWith(
      workspaceMember,
    );
  });

  it('loads groups through connection manager using the group membership join', async () => {
    const { resolver, cm } = createResolver();
    const workspaceMember = { id: 'member_1' } as WorkspaceMember;
    const args = { first: 10 } as never;

    await resolver.groups(workspaceMember, args);

    expect(cm.find).toHaveBeenCalledWith(expect.any(Function), args, {
      where: {
        groupMembers: {
          member: workspaceMember,
        },
      },
    });
  });
});

function createResolver(overrides?: {
  workspaceMemberService?: Partial<WorkspaceMemberService>;
  userService?: Partial<UserService>;
  cm?: { find: Mock };
}) {
  const workspaceMemberService = {
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    create: vi.fn(),
    createServiceAccount: vi.fn(),
    updateWorkspaceMember: vi.fn(),
    remove: vi.fn(),
    createWorkspaceInvite: vi.fn(),
    findWorkspaceInviteByToken: vi.fn(),
    acceptWorkspaceInvite: vi.fn(),
    acceptWorkspaceInviteByToken: vi.fn(),
    getPermissions: vi.fn(),
    ...overrides?.workspaceMemberService,
  } as unknown as Mocked<WorkspaceMemberService>;
  const userService = {
    findOne: vi.fn(),
    ...overrides?.userService,
  } as unknown as Mocked<UserService>;
  const cm = overrides?.cm ?? { find: vi.fn() };
  const resolver = new WorkspaceMemberResolver(
    workspaceMemberService,
    userService,
    cm as never,
  );

  return {
    resolver,
    workspaceMemberService,
    userService,
    cm,
  };
}
