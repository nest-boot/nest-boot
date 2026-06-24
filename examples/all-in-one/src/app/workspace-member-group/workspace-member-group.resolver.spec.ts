import type { Mocked } from 'vitest';
vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
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

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberGroup } from './workspace-member-group.entity.js';
import { WorkspaceMemberGroupResolver } from './workspace-member-group.resolver.js';
import { WorkspaceMemberGroupService } from './workspace-member-group.service.js';

describe('WorkspaceMemberGroupResolver', () => {
  it('filters group connections by current workspace', async () => {
    const { resolver, cm } = createResolver();
    const workspace = { id: 'workspace_1' } as Workspace;
    const args = { first: 10 } as never;

    await resolver.workspaceMemberGroups(workspace, args);

    expect(cm.find).toHaveBeenCalledWith(expect.any(Function), args, {
      where: {
        workspace,
      },
    });
  });

  it('finds a group by id inside the current workspace', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const group = { id: 'group_1' } as WorkspaceMemberGroup;
    const { resolver, workspaceMemberGroupService } = createResolver({
      workspaceMemberGroupService: {
        findOneOrFail: vi.fn(async () => group),
      },
    });

    await expect(
      resolver.workspaceMemberGroup(workspace, 'group_1'),
    ).resolves.toBe(group);

    expect(workspaceMemberGroupService.findOneOrFail).toHaveBeenCalledWith({
      id: 'group_1',
      workspace,
    });
  });

  it('delegates group creation to the service', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const group = { id: 'group_1' } as WorkspaceMemberGroup;
    const { resolver, workspaceMemberGroupService } = createResolver({
      workspaceMemberGroupService: {
        createWorkspaceMemberGroup: vi.fn(async () => group),
      },
    });

    await expect(
      resolver.createWorkspaceMemberGroup(workspace, { name: 'Admins' }),
    ).resolves.toBe(group);

    expect(
      workspaceMemberGroupService.createWorkspaceMemberGroup,
    ).toHaveBeenCalledWith(workspace, { name: 'Admins' });
  });

  it('loads a scoped group before updating', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const group = { id: 'group_1' } as WorkspaceMemberGroup;
    const { resolver, workspaceMemberGroupService } = createResolver({
      workspaceMemberGroupService: {
        findOneOrFail: vi.fn(async () => group),
        updateWorkspaceMemberGroup: vi.fn(async () => group),
      },
    });

    await expect(
      resolver.updateWorkspaceMemberGroup(workspace, 'group_1', {
        name: 'Operators',
      }),
    ).resolves.toBe(group);

    expect(workspaceMemberGroupService.findOneOrFail).toHaveBeenCalledWith({
      id: 'group_1',
      workspace,
    });
    expect(
      workspaceMemberGroupService.updateWorkspaceMemberGroup,
    ).toHaveBeenCalledWith(group, { name: 'Operators' });
  });

  it('loads a scoped group before deleting', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const group = { id: 'group_1' } as WorkspaceMemberGroup;
    const { resolver, workspaceMemberGroupService } = createResolver({
      workspaceMemberGroupService: {
        findOneOrFail: vi.fn(async () => group),
        remove: vi.fn(async () => group),
      },
    });

    await expect(
      resolver.deleteWorkspaceMemberGroup(workspace, 'group_1'),
    ).resolves.toBe(group);

    expect(workspaceMemberGroupService.remove).toHaveBeenCalledWith(group);
  });

  it('delegates member additions and removals to the service', async () => {
    const group = { id: 'group_1' } as WorkspaceMemberGroup;
    const { resolver, workspaceMemberGroupService } = createResolver({
      workspaceMemberGroupService: {
        addMembers: vi.fn(async () => group),
        removeMembers: vi.fn(async () => group),
      },
    });

    await expect(
      resolver.addMembersToWorkspaceMemberGroup('group_1', ['member_1']),
    ).resolves.toBe(group);
    await expect(
      resolver.removeMembersFromWorkspaceMemberGroup('group_1', ['member_1']),
    ).resolves.toBe(group);

    expect(workspaceMemberGroupService.addMembers).toHaveBeenCalledWith(
      'group_1',
      ['member_1'],
    );
    expect(workspaceMemberGroupService.removeMembers).toHaveBeenCalledWith(
      'group_1',
      ['member_1'],
    );
  });

  it('loads members through connection manager using the group membership join', async () => {
    const { resolver, cm } = createResolver();
    const group = { id: 'group_1' } as WorkspaceMemberGroup;
    const args = { first: 10 } as never;

    await resolver.members(group, args);

    expect(cm.find).toHaveBeenCalledWith(expect.any(Function), args, {
      where: {
        groupMembers: {
          group,
        },
      },
    });
  });
});

function createResolver(overrides?: {
  workspaceMemberGroupService?: Partial<WorkspaceMemberGroupService>;
  cm?: { find: Mock };
}) {
  const workspaceMemberGroupService = {
    findOneOrFail: vi.fn(),
    createWorkspaceMemberGroup: vi.fn(),
    updateWorkspaceMemberGroup: vi.fn(),
    remove: vi.fn(),
    addMembers: vi.fn(),
    removeMembers: vi.fn(),
    ...overrides?.workspaceMemberGroupService,
  } as unknown as Mocked<WorkspaceMemberGroupService>;
  const cm = overrides?.cm ?? { find: vi.fn() };
  const resolver = new WorkspaceMemberGroupResolver(
    workspaceMemberGroupService,
    cm as never,
  );

  return {
    resolver,
    workspaceMemberGroupService,
    cm,
  };
}
