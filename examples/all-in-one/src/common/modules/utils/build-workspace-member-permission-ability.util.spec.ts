vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import { subject } from '@casl/ability';
import { PermissionAction } from '@nest-boot/permission';
import { RequestContext } from '@nest-boot/request-context';

import { ApiKey } from '../../../app/api-key/api-key.entity.js';
import { User } from '../../../app/user/user.entity.js';
import { Workspace } from '../../../app/workspace/workspace.entity.js';
import { WorkspaceMemberRole } from '../../../app/workspace-member/enums/workspace-member-role.enum.js';
import { WorkspaceMemberStatus } from '../../../app/workspace-member/enums/workspace-member-status.enum.js';
import { WorkspaceMember } from '../../../app/workspace-member/workspace-member.entity.js';
import { WorkspaceMemberPermission } from '../../../app/workspace-member/workspace-member-permission.enum.js';
import { WorkspaceMemberGroup } from '../../../app/workspace-member-group/workspace-member-group.entity.js';
import { WorkspaceMemberGroupMember } from '../../../app/workspace-member-group-member/workspace-member-group-member.entity.js';
import { buildWorkspaceMemberPermissionAbility } from './build-workspace-member-permission-ability.util.js';

vi.mock('@nest-boot/request-context', () => ({
  RequestContext: {
    get: vi.fn(),
  },
}));

describe('buildWorkspaceMemberPermissionAbility', () => {
  beforeEach(() => {
    vi.mocked(RequestContext.get).mockReset();
  });

  it('grants base permissions when there is no active workspace member', () => {
    vi.mocked(RequestContext.get).mockReturnValue(undefined);

    const ability = buildWorkspaceMemberPermissionAbility([]);

    expect(ability.can(PermissionAction.READ, User)).toBe(true);
    expect(ability.can(PermissionAction.CREATE, Workspace)).toBe(true);
    expect(ability.can(PermissionAction.READ, Workspace)).toBe(true);
    expect(ability.can(PermissionAction.UPDATE, Workspace)).toBe(false);
  });

  it('only grants base permissions for disabled workspace members', () => {
    vi.mocked(RequestContext.get).mockReturnValue({
      status: WorkspaceMemberStatus.DISABLED,
    });

    const ability = buildWorkspaceMemberPermissionAbility([]);

    expect(ability.can(PermissionAction.CREATE, Workspace)).toBe(true);
    expect(ability.can(PermissionAction.MANAGE, ApiKey)).toBe(false);
  });

  it('grants owners full management permissions', () => {
    const ability = buildAbility({
      role: WorkspaceMemberRole.OWNER,
      permissions: [],
      workspace: {
        id: 'workspace_1',
      } as WorkspaceMember['workspace'],
    });

    expect(ability.can(PermissionAction.MANAGE, Workspace)).toBe(true);
    expect(ability.can(PermissionAction.DELETE, Workspace)).toBe(true);
    expect(
      ability.can(
        PermissionAction.UPDATE,
        subject('Workspace', { id: 'workspace_1' }),
      ),
    ).toBe(true);
    expect(
      ability.can(
        PermissionAction.UPDATE,
        subject('Workspace', { id: 'workspace_2' }),
      ),
    ).toBe(false);
  });

  it('allows admins to manage everything except workspace deletion', () => {
    const ability = buildAbility({
      role: WorkspaceMemberRole.ADMIN,
      permissions: [],
      workspace: {
        id: 'workspace_1',
      } as WorkspaceMember['workspace'],
    });

    expect(ability.can(PermissionAction.MANAGE, ApiKey)).toBe(true);
    expect(ability.can(PermissionAction.DELETE, Workspace)).toBe(false);
    expect(
      ability.can(
        PermissionAction.UPDATE,
        subject('Workspace', { id: 'workspace_1' }),
      ),
    ).toBe(true);
    expect(
      ability.can(
        PermissionAction.UPDATE,
        subject('Workspace', { id: 'workspace_2' }),
      ),
    ).toBe(false);
  });

  it('combines direct and group permissions for regular members', () => {
    const ability = buildAbility(
      {
        role: WorkspaceMemberRole.MEMBER,
        permissions: [WorkspaceMemberPermission.MANAGE_WORKSPACE],
        workspace: {
          id: 'workspace_1',
        } as WorkspaceMember['workspace'],
      },
      [
        WorkspaceMemberPermission.MANAGE_WORKSPACE,
        WorkspaceMemberPermission.MANAGE_MEMBERS,
      ],
    );

    expect(ability.can(PermissionAction.READ, Workspace)).toBe(true);
    expect(ability.can(PermissionAction.MANAGE, Workspace)).toBe(true);
    expect(
      ability.can(
        PermissionAction.UPDATE,
        subject('Workspace', { id: 'workspace_1' }),
      ),
    ).toBe(true);
    expect(
      ability.can(
        PermissionAction.UPDATE,
        subject('Workspace', { id: 'workspace_2' }),
      ),
    ).toBe(false);
    expect(ability.can(PermissionAction.MANAGE, WorkspaceMember)).toBe(true);
    expect(ability.can(PermissionAction.MANAGE, WorkspaceMemberGroup)).toBe(
      true,
    );
    expect(
      ability.can(PermissionAction.MANAGE, WorkspaceMemberGroupMember),
    ).toBe(true);
    expect(ability.can(PermissionAction.CREATE, ApiKey)).toBe(true);
  });

  it('uses provided effective permissions', () => {
    vi.mocked(RequestContext.get).mockReturnValue({
      status: WorkspaceMemberStatus.ACTIVE,
      role: WorkspaceMemberRole.MEMBER,
    });

    const ability = buildWorkspaceMemberPermissionAbility([
      WorkspaceMemberPermission.MANAGE_MEMBERS,
    ]);

    expect(ability.can(PermissionAction.MANAGE, WorkspaceMember)).toBe(true);
  });
});

function buildAbility(
  member: Partial<WorkspaceMember>,
  permissions: WorkspaceMemberPermission[] = member.permissions ?? [],
) {
  vi.mocked(RequestContext.get).mockReturnValue({
    status: WorkspaceMemberStatus.ACTIVE,
    ...member,
  });

  return buildWorkspaceMemberPermissionAbility(permissions);
}
