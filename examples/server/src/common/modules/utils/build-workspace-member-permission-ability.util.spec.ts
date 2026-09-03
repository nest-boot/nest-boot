vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
}));

import { ApiKey } from '../../../app/api-key/api-key.entity.js';
import { User } from '../../../app/user/user.entity.js';
import { Workspace } from '../../../app/workspace/workspace.entity.js';
import { WorkspaceMemberStatus } from '../../../app/workspace-member/enums/workspace-member-status.enum.js';
import { WorkspaceInvitation } from '../../../app/workspace-member/workspace-invitation.entity.js';
import { WorkspaceMember } from '../../../app/workspace-member/workspace-member.entity.js';
import {
  buildUserPermissionAbility,
  buildWorkspaceMemberPermissionAbility,
} from './build-workspace-member-permission-ability.util.js';

describe('permission ability builders', () => {
  it('builds user permissions independently of workspace membership', () => {
    const ability = buildUserPermissionAbility(['user:delete']);

    expect(ability.can('read', User)).toBe(true);
    expect(ability.can('create', Workspace)).toBe(true);
    expect(ability.can('manage', ApiKey)).toBe(true);
    expect(ability.can('delete', Workspace)).toBe(false);
    expect(ability.can('delete', User)).toBe(true);
  });

  it('does not grant workspace permissions without an active member', () => {
    expect(
      buildWorkspaceMemberPermissionAbility([]).can('read', Workspace),
    ).toBe(false);
    expect(
      buildWorkspaceMemberPermissionAbility(
        [],
        member({ status: WorkspaceMemberStatus.DISABLED }),
      ).can('read', Workspace),
    ).toBe(false);
    expect(
      buildWorkspaceMemberPermissionAbility([]).can('update', Workspace),
    ).toBe(false);
  });

  it('builds workspace permissions after role permissions are resolved', () => {
    const ability = buildWorkspaceMemberPermissionAbility(
      [
        'workspace:update',
        'workspace:delete',
        'apiKey:create',
        'apiKey:update',
        'apiKey:delete',
      ],
      member({ roles: ['owner'] }),
    );

    expect(ability.can('create', ApiKey)).toBe(true);
    expect(ability.can('update', ApiKey)).toBe(true);
    expect(ability.can('delete', ApiKey)).toBe(true);
    expect(ability.can('delete', Workspace)).toBe(true);
    expect(ability.can('read', WorkspaceInvitation)).toBe(true);
    expect(ability.can('update', Workspace)).toBe(true);
  });

  it('only grants the resolved permissions supplied by the guard', () => {
    const ability = buildWorkspaceMemberPermissionAbility(
      ['workspace:update', 'workspaceMember:update'],
      member({ roles: ['admin'] }),
    );

    expect(ability.can('create', ApiKey)).toBe(false);
    expect(ability.can('delete', Workspace)).toBe(false);
    expect(ability.can('update', Workspace)).toBe(true);
    expect(ability.can('update', WorkspaceMember)).toBe(true);
  });

  it('applies direct permissions after role permissions are resolved', () => {
    const ability = buildWorkspaceMemberPermissionAbility(
      ['workspace:delete'],
      member({ roles: ['admin'] }),
    );

    expect(ability.can('delete', Workspace)).toBe(true);
  });

  it('applies member permissions without reading API-key context', () => {
    const ability = buildWorkspaceMemberPermissionAbility(
      ['workspace:update', 'workspaceMember:delete'],
      member({ roles: ['member'] }),
    );

    expect(ability.can('update', Workspace)).toBe(true);
    expect(ability.can('delete', WorkspaceMember)).toBe(true);
    expect(ability.can('create', ApiKey)).toBe(false);
  });

  it('does not grant member updates without the explicit permission', () => {
    const ability = buildWorkspaceMemberPermissionAbility(
      [],
      member({ roles: ['member'] }),
    );

    expect(ability.can('read', WorkspaceMember)).toBe(true);
    expect(ability.can('update', WorkspaceMember)).toBe(false);
  });

  it('supports application-defined action strings', () => {
    const ability = buildWorkspaceMemberPermissionAbility(
      ['workspace:publish'],
      member({ roles: ['member'] }),
    );

    expect(ability.can('publish', Workspace)).toBe(true);
  });
});

function member(overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: 'member_1',
    name: 'Alice',
    permissions: [],
    roles: ['member'],
    status: WorkspaceMemberStatus.ACTIVE,
    workspace: { id: 'workspace_1' } as WorkspaceMember['workspace'],
    ...overrides,
  } as WorkspaceMember;
}
