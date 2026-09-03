import type { WorkspaceService } from '@nest-boot/auth';
import type { Mocked } from 'vitest';

vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
  CurrentUser: () => () => undefined,
  CurrentWorkspace: () => () => undefined,
  CurrentWorkspaceMember: () => () => undefined,
  UserCan: () => () => undefined,
  WorkspaceCan: () => () => undefined,
  WorkspaceService: class WorkspaceService {},
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

import { User } from '../user/user.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { Workspace } from './workspace.entity.js';
import { WorkspaceResolver } from './workspace.resolver.js';

describe('WorkspaceResolver', () => {
  it('returns the selected workspace or null', () => {
    const { resolver } = createResolver();
    const workspace = { id: 'workspace_1' } as Workspace;

    expect(resolver.currentWorkspace(workspace)).toBe(workspace);
    expect(resolver.currentWorkspace()).toBeNull();
  });

  it('filters workspace connections by the current user membership', async () => {
    const { resolver, cm } = createResolver();
    const user = { id: 'user_1' } as User;
    const args = { first: 20 } as never;

    await resolver.workspaces(user, args);

    expect(cm.find).toHaveBeenCalledWith(expect.any(Function), args, {
      where: { members: { user } },
    });
  });

  it('returns a workspace only when the current user is an active member', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const user = { id: 'user_1' } as User;
    const { resolver, workspaceService } = createResolver({
      findOne: vi.fn(async () => workspace),
      getMember: vi.fn(async () => ({ id: 'member_1' }) as WorkspaceMember),
    });

    await expect(resolver.workspace(workspace.id, user)).resolves.toBe(
      workspace,
    );
    expect(workspaceService.getMember).toHaveBeenCalledWith(workspace, user);

    workspaceService.getMember.mockResolvedValueOnce(null);
    await expect(resolver.workspace(workspace.id, user)).resolves.toBeNull();
  });

  it('delegates workspace lifecycle operations to the auth service', async () => {
    const workspace = { id: 'workspace_1', name: 'Acme' } as Workspace;
    const member = { id: 'member_1' } as WorkspaceMember;
    const user = { id: 'user_1' } as User;
    const { resolver, workspaceService } = createResolver({
      createWorkspace: vi.fn(async () => workspace),
      updateWorkspace: vi.fn(async () => workspace),
      deleteWorkspace: vi.fn(async () => workspace),
    });

    await expect(
      resolver.createWorkspace(user, { name: 'Acme' }),
    ).resolves.toBe(workspace);
    await expect(
      resolver.updateWorkspace(workspace, { name: 'New' }),
    ).resolves.toBe(workspace);
    await expect(resolver.deleteWorkspace(workspace, member)).resolves.toBe(
      workspace,
    );

    expect(workspaceService.createWorkspace).toHaveBeenCalledWith(user, {
      name: 'Acme',
    });
    expect(workspaceService.updateWorkspace).toHaveBeenCalledWith(workspace, {
      name: 'New',
    });
    expect(workspaceService.deleteWorkspace).toHaveBeenCalledWith(
      workspace,
      member,
    );
  });

  it('transfers ownership to a workspace user member', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const currentOwner = { id: 'member_1' } as WorkspaceMember;
    const nextOwner = {
      id: 'member_2',
      user: { id: 'user_2' },
    } as WorkspaceMember;
    const { resolver, workspaceService } = createResolver({
      getMemberById: vi.fn(async () => nextOwner),
      transferOwnership: vi.fn(async () => nextOwner),
    });

    await expect(
      resolver.transferWorkspaceOwnership(
        nextOwner.id,
        workspace,
        currentOwner,
      ),
    ).resolves.toBe(nextOwner);
    expect(workspaceService.transferOwnership).toHaveBeenCalledWith(
      workspace,
      currentOwner,
      nextOwner,
    );
  });

  it('delegates leaving a workspace to the auth service', async () => {
    const member = { id: 'member_1' } as WorkspaceMember;
    const { resolver, workspaceService } = createResolver({
      leaveWorkspace: vi.fn(async () => member),
    });

    await expect(resolver.leaveWorkspace(member)).resolves.toBe(member);
    expect(workspaceService.leaveWorkspace).toHaveBeenCalledWith(member);
  });
});

function createResolver(overrides: Partial<WorkspaceService> = {}) {
  const workspaceService = {
    createWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    findOne: vi.fn(),
    getMember: vi.fn(),
    getMemberById: vi.fn(),
    leaveWorkspace: vi.fn(),
    transferOwnership: vi.fn(),
    updateWorkspace: vi.fn(),
    ...overrides,
  } as unknown as Mocked<WorkspaceService>;
  const cm = { find: vi.fn() };

  return {
    resolver: new WorkspaceResolver(workspaceService, cm as never),
    workspaceService,
    cm,
  };
}
