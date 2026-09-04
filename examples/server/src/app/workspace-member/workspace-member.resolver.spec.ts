import type { Mock, Mocked } from 'vitest';
vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
  CurrentUser: () => () => undefined,
  CurrentWorkspace: () => () => undefined,
  CurrentWorkspaceMember: () => () => undefined,
  WorkspaceCan: () => () => undefined,
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

import type { WorkspaceService } from '@nest-boot/auth';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from './workspace-member.entity.js';
import { WorkspaceMemberResolver } from './workspace-member.resolver.js';
import { WorkspaceMemberService } from './workspace-member.service.js';

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
    const workspace = { id: 'workspace_1' } as Workspace;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        findOne: vi.fn(async () => member),
      },
    });

    await expect(resolver.workspaceMember('member_1', workspace)).resolves.toBe(
      member,
    );

    expect(workspaceMemberService.findOne).toHaveBeenCalledWith({
      id: 'member_1',
      workspace,
    });
  });

  it('delegates adding an existing user to WorkspaceService', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const createdMember = { id: 'member_2' } as WorkspaceMember;
    const { resolver, workspaceService } = createResolver({
      workspaceService: {
        addMemberByEmail: vi.fn(async () => createdMember),
      },
    });

    await expect(
      resolver.addWorkspaceMember(workspace, { email: 'alice@example.com' }),
    ).resolves.toBe(createdMember);

    expect(workspaceService.addMemberByEmail).toHaveBeenCalledWith(
      workspace,
      'alice@example.com',
    );
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
      resolver.createServiceAccountWorkspaceMember(workspace, {
        name: 'Deploy Bot',
      }),
    ).resolves.toBe(created);

    expect(workspaceMemberService.createServiceAccount).toHaveBeenCalledWith(
      workspace,
      { name: 'Deploy Bot' },
    );
  });

  it('rejects direct permission changes by non owners', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const target = {
      id: 'member_2',
      roles: ['member'],
    } as WorkspaceMember;
    const { resolver, workspaceMemberService, workspaceService } =
      createResolver({
        workspaceMemberService: {
          findOneOrFail: vi.fn(async () => target),
        },
        workspaceService: {
          setMemberPermissions: vi.fn(async () => target),
        },
      });

    await expect(
      resolver.setWorkspaceMemberPermissions(
        workspace,
        { roles: ['admin'] } as WorkspaceMember,
        target.id,
        { permissions: [] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(workspaceMemberService.findOneOrFail).not.toHaveBeenCalled();
    expect(workspaceService.setMemberPermissions).not.toHaveBeenCalled();
  });

  it('rejects updating other owners', async () => {
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        findOneOrFail: vi.fn(
          async () =>
            ({
              id: 'member_2',
              roles: ['owner'],
            }) as WorkspaceMember,
        ),
      },
    });

    await expect(
      resolver.updateWorkspaceMember(
        { id: 'workspace_1' } as Workspace,
        {
          id: 'member_1',
          roles: ['admin'],
        } as WorkspaceMember,
        'member_2',
        { name: 'New' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(workspaceMemberService.updateWorkspaceMember).not.toHaveBeenCalled();
  });

  it('allows authorized members to update regular member fields', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const member = {
      id: 'member_2',
      roles: ['member'],
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
        workspace,
        {
          id: 'member_1',
          roles: ['admin'],
        } as WorkspaceMember,
        'member_2',
        { name: 'Alice' },
      ),
    ).resolves.toBe(updated);

    expect(workspaceMemberService.updateWorkspaceMember).toHaveBeenCalledWith(
      member,
      { name: 'Alice' },
    );
    expect(workspaceMemberService.findOneOrFail).toHaveBeenCalledWith({
      id: 'member_2',
      workspace,
    });
  });

  it('lists roles and updates member roles through WorkspaceService', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const member = { id: 'member_2', roles: ['member'] } as WorkspaceMember;
    const roles = [{ name: 'admin', permissions: ['workspace:update'] }];
    const { resolver, workspaceMemberService, workspaceService } =
      createResolver({
        workspaceMemberService: {
          findOneOrFail: vi.fn(async () => member),
        },
        workspaceService: {
          listPermissions: vi.fn(() => ['workspace:update']),
          listRoles: vi.fn(() => roles),
          updateMemberRole: vi.fn(async () => member),
        },
      });

    expect(resolver.workspaceRoles()).toEqual(roles);
    expect(resolver.workspacePermissions()).toEqual(['workspace:update']);
    await expect(
      resolver.updateWorkspaceMemberRole(workspace, member.id, {
        roles: ['admin'],
      }),
    ).resolves.toBe(member);
    expect(workspaceMemberService.findOneOrFail).toHaveBeenCalledWith({
      id: member.id,
      workspace,
    });
    expect(workspaceService.updateMemberRole).toHaveBeenCalledWith(member, [
      'admin',
    ]);
  });

  it('allows owners to update their own owner member record', async () => {
    const member = {
      id: 'member_1',
      roles: ['owner'],
    } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver({
      workspaceMemberService: {
        findOneOrFail: vi.fn(async () => member),
        updateWorkspaceMember: vi.fn(async () => member),
      },
    });

    await expect(
      resolver.updateWorkspaceMember(
        { id: 'workspace_1' } as Workspace,
        member,
        'member_1',
        { name: 'Owner' },
      ),
    ).resolves.toBe(member);
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
        { id: 'workspace_1' } as Workspace,
        {
          id: 'member_1',
          roles: ['owner'],
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
        { id: 'workspace_1' } as Workspace,
        {
          id: 'member_1',
          roles: ['owner'],
        } as WorkspaceMember,
        'member_2',
      ),
    ).resolves.toBe(member);

    expect(workspaceMemberService.remove).toHaveBeenCalledWith(member);
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
});

function createResolver(overrides?: {
  workspaceMemberService?: Partial<WorkspaceMemberService>;
  workspaceService?: Partial<WorkspaceService>;
  cm?: { find: Mock };
}) {
  const workspaceMemberService = {
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    create: vi.fn(),
    createServiceAccount: vi.fn(),
    updateWorkspaceMember: vi.fn(),
    remove: vi.fn(),
    ...overrides?.workspaceMemberService,
  } as unknown as Mocked<WorkspaceMemberService>;
  const cm = overrides?.cm ?? { find: vi.fn() };
  const workspaceService = {
    addMemberByEmail: vi.fn(),
    listPermissions: vi.fn(() => []),
    listRoles: vi.fn(() => []),
    setMemberPermissions: vi.fn(),
    updateMemberRole: vi.fn(),
    ...overrides?.workspaceService,
  } as unknown as Mocked<WorkspaceService>;
  const resolver = new WorkspaceMemberResolver(
    workspaceMemberService,
    cm as never,
    workspaceService,
  );

  return {
    resolver,
    workspaceMemberService,
    cm,
    workspaceService,
  };
}
