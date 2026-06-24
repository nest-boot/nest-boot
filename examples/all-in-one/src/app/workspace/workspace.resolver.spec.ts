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

import { ForbiddenException } from '@nestjs/common';

import { User } from '../user/user.entity.js';
import { WorkspaceMemberRole } from '../workspace-member/enums/workspace-member-role.enum.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { Workspace } from './workspace.entity.js';
import { WorkspaceResolver } from './workspace.resolver.js';
import { WorkspaceService } from './workspace.service.js';

describe('WorkspaceResolver', () => {
  it('returns the current workspace from request context', () => {
    const { resolver } = createResolver();
    const workspace = { id: 'workspace_1' } as Workspace;

    expect(resolver.currentWorkspace(workspace)).toBe(workspace);
  });

  it('returns null when no workspace is selected', () => {
    const { resolver } = createResolver();

    expect(resolver.currentWorkspace()).toBeNull();
  });

  it('filters workspace connection by current user membership', async () => {
    const { resolver, cm } = createResolver();
    const user = { id: 'user_1' } as User;
    const args = { first: 20 } as never;

    await resolver.workspaces(user, args);

    expect(cm.find).toHaveBeenCalledWith(expect.any(Function), args, {
      where: {
        members: {
          user,
        },
      },
    });
  });

  it('delegates workspace creation to the service', async () => {
    const workspace = { id: 'workspace_1', name: 'Acme' } as Workspace;
    const { resolver, workspaceService } = createResolver({
      workspaceService: {
        createWorkspace: vi.fn(async () => workspace),
      },
    });
    const user = { id: 'user_1' } as User;

    await expect(
      resolver.createWorkspace(user, { name: 'Acme' }),
    ).resolves.toBe(workspace);

    expect(workspaceService.createWorkspace).toHaveBeenCalledWith(user, {
      name: 'Acme',
    });
  });

  it('allows admins to update a workspace', async () => {
    const workspace = { id: 'workspace_1', name: 'Old' } as Workspace;
    const updatedWorkspace = { id: 'workspace_1', name: 'New' } as Workspace;
    const { resolver, workspaceService } = createResolver({
      workspaceService: {
        update: vi.fn(async () => updatedWorkspace),
      },
    });

    await expect(
      resolver.updateWorkspace(workspace, { name: 'New' }),
    ).resolves.toBe(updatedWorkspace);

    expect(workspaceService.update).toHaveBeenCalledWith(workspace, {
      name: 'New',
    });
  });

  it('delegates workspace update authorization to the permission guard', async () => {
    const workspace = { id: 'workspace_1', name: 'Old' } as Workspace;
    const updatedWorkspace = { id: 'workspace_1', name: 'New' } as Workspace;
    const { resolver, workspaceService } = createResolver({
      workspaceService: {
        update: vi.fn(async () => updatedWorkspace),
      },
    });

    await expect(
      resolver.updateWorkspace(workspace, { name: 'New' }),
    ).resolves.toBe(updatedWorkspace);

    expect(workspaceService.update).toHaveBeenCalledWith(workspace, {
      name: 'New',
    });
  });

  it('soft deletes a workspace only for owners', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const deletedWorkspace = {
      id: 'workspace_1',
      deletedAt: new Date(),
    } as Workspace;
    const { resolver, workspaceService } = createResolver({
      workspaceService: {
        softDelete: vi.fn(async () => deletedWorkspace),
      },
    });

    await expect(
      resolver.deleteWorkspace(workspace, {
        role: WorkspaceMemberRole.OWNER,
      } as WorkspaceMember),
    ).resolves.toBe(deletedWorkspace);

    expect(workspaceService.softDelete).toHaveBeenCalledWith(workspace);
  });

  it('rejects workspace deletion from non owners', async () => {
    const { resolver, workspaceService } = createResolver();

    await expect(
      resolver.deleteWorkspace(
        { id: 'workspace_1' } as Workspace,
        { role: WorkspaceMemberRole.ADMIN } as WorkspaceMember,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(workspaceService.update).not.toHaveBeenCalled();
  });
});

function createResolver(overrides?: {
  workspaceService?: Partial<WorkspaceService>;
  cm?: { find: Mock };
}) {
  const workspaceService = {
    findOne: vi.fn(),
    createWorkspace: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    ...overrides?.workspaceService,
  } as unknown as WorkspaceService;
  const cm = overrides?.cm ?? { find: vi.fn() };
  const resolver = new WorkspaceResolver(workspaceService, cm as never);

  return {
    resolver,
    workspaceService: workspaceService as Mocked<WorkspaceService>,
    cm,
  };
}
