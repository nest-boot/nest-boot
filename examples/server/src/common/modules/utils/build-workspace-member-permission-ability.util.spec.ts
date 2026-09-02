vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
}));

import { subject } from '@casl/ability';

import { ApiKey } from '../../../app/api-key/api-key.entity.js';
import { UserPermission } from '../../../app/auth/enums/user-permission.enum.js';
import { WorkspacePermission } from '../../../app/auth/enums/workspace-permission.enum.js';
import { User } from '../../../app/user/user.entity.js';
import { Workspace } from '../../../app/workspace/workspace.entity.js';
import { WorkspaceMemberRole } from '../../../app/workspace-member/enums/workspace-member-role.enum.js';
import { WorkspaceMemberStatus } from '../../../app/workspace-member/enums/workspace-member-status.enum.js';
import { WorkspaceMember } from '../../../app/workspace-member/workspace-member.entity.js';
import {
  buildUserPermissionAbility,
  buildWorkspaceMemberPermissionAbility,
} from './build-workspace-member-permission-ability.util.js';

describe('permission ability builders', () => {
  it('builds user permissions independently of workspace membership', () => {
    const ability = buildUserPermissionAbility([UserPermission.USER_DELETE]);

    expect(ability.can('read', User)).toBe(true);
    expect(ability.can('create', Workspace)).toBe(true);
    expect(ability.can('manage', ApiKey)).toBe(true);
    expect(ability.can('delete', Workspace)).toBe(false);
    expect(ability.can('delete', User)).toBe(true);
  });

  it('only grants workspace discovery permissions without an active member', () => {
    expect(
      buildWorkspaceMemberPermissionAbility([]).can('read', Workspace),
    ).toBe(true);
    expect(
      buildWorkspaceMemberPermissionAbility(
        [],
        member({ status: WorkspaceMemberStatus.DISABLED }),
      ).can('read', Workspace),
    ).toBe(true);
    expect(
      buildWorkspaceMemberPermissionAbility([]).can('update', Workspace),
    ).toBe(false);
  });

  it('grants owners full management only inside their workspace', () => {
    const ability = buildWorkspaceMemberPermissionAbility(
      [],
      member({ role: WorkspaceMemberRole.OWNER }),
    );

    expect(ability.can('manage', ApiKey)).toBe(true);
    expect(ability.can('delete', Workspace)).toBe(true);
    expect(
      ability.can('update', subject('Workspace', { id: 'workspace_1' })),
    ).toBe(true);
    expect(
      ability.can('update', subject('Workspace', { id: 'workspace_2' })),
    ).toBe(false);
  });

  it('keeps workspace API keys and deletion away from admins', () => {
    const ability = buildWorkspaceMemberPermissionAbility(
      [],
      member({ role: WorkspaceMemberRole.ADMIN }),
    );

    expect(ability.can('manage', ApiKey)).toBe(false);
    expect(ability.can('delete', Workspace)).toBe(false);
    expect(
      ability.can('update', subject('Workspace', { id: 'workspace_1' })),
    ).toBe(true);
  });

  it('applies member permissions without reading API-key context', () => {
    const ability = buildWorkspaceMemberPermissionAbility(
      [
        WorkspacePermission.WORKSPACE_UPDATE,
        WorkspacePermission.WORKSPACE_MEMBER_DELETE,
      ],
      member({ role: WorkspaceMemberRole.MEMBER }),
    );

    expect(ability.can('update', Workspace)).toBe(true);
    expect(ability.can('delete', WorkspaceMember)).toBe(true);
    expect(ability.can('create', ApiKey)).toBe(false);
  });

  it('supports application-defined action strings', () => {
    const ability = buildWorkspaceMemberPermissionAbility(
      ['workspace:publish' as WorkspacePermission],
      member({ role: WorkspaceMemberRole.MEMBER }),
    );

    expect(ability.can('publish', Workspace)).toBe(true);
  });
});

function member(overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: 'member_1',
    name: 'Alice',
    permissions: [],
    role: WorkspaceMemberRole.MEMBER,
    status: WorkspaceMemberStatus.ACTIVE,
    workspace: { id: 'workspace_1' } as WorkspaceMember['workspace'],
    ...overrides,
  } as WorkspaceMember;
}
