vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
}));

import { AbilityBuilder } from '@casl/ability';
import { UserAbility, WorkspaceAbility } from '@nest-boot/auth';

import { ApiKey } from '../../../app/api-key/api-key.entity.js';
import { User } from '../../../app/user/user.entity.js';
import { Workspace } from '../../../app/workspace/workspace.entity.js';
import { WorkspaceInvitation } from '../../../app/workspace-member/workspace-invitation.entity.js';
import { WorkspaceMember } from '../../../app/workspace-member/workspace-member.entity.js';
import {
  buildUserPermissionAbility,
  buildWorkspacePermissionAbility,
} from './build-permission-ability.util.js';

describe('permission ability builders', () => {
  it('builds user permissions independently of workspace membership', () => {
    const ability = buildUserPermissionAbility(
      new AbilityBuilder(UserAbility),
      ['user:delete'],
    );

    expect(ability.can('read', User)).toBe(true);
    expect(ability.can('create', Workspace)).toBe(true);
    expect(ability.can('manage', ApiKey)).toBe(true);
    expect(ability.can('delete', Workspace)).toBe(false);
    expect(ability.can('delete', User)).toBe(true);
  });

  it('builds baseline workspace rules from an empty resolved permission list', () => {
    const ability = buildWorkspacePermissionAbility(
      new AbilityBuilder(WorkspaceAbility),
      [],
    );

    expect(ability.can('read', Workspace)).toBe(true);
    expect(ability.can('read', WorkspaceMember)).toBe(true);
    expect(ability.can('update', Workspace)).toBe(false);
  });

  it('builds workspace rules from permissions resolved by the guard', () => {
    const ability = buildWorkspacePermissionAbility(
      new AbilityBuilder(WorkspaceAbility),
      [
        'workspace:update',
        'workspace:delete',
        'apiKey:create',
        'apiKey:update',
        'apiKey:delete',
      ],
    );

    expect(ability.can('create', ApiKey)).toBe(true);
    expect(ability.can('update', ApiKey)).toBe(true);
    expect(ability.can('delete', ApiKey)).toBe(true);
    expect(ability.can('delete', Workspace)).toBe(true);
    expect(ability.can('read', WorkspaceInvitation)).toBe(true);
    expect(ability.can('update', Workspace)).toBe(true);
  });

  it('only grants the supplied resolved permissions', () => {
    const ability = buildWorkspacePermissionAbility(
      new AbilityBuilder(WorkspaceAbility),
      ['workspace:update', 'workspaceMember:update'],
    );

    expect(ability.can('create', ApiKey)).toBe(false);
    expect(ability.can('delete', Workspace)).toBe(false);
    expect(ability.can('update', Workspace)).toBe(true);
    expect(ability.can('update', WorkspaceMember)).toBe(true);
  });

  it('supports application-defined action strings', () => {
    const ability = buildWorkspacePermissionAbility(
      new AbilityBuilder(WorkspaceAbility),
      ['workspace:publish'],
    );

    expect(ability.can('publish', Workspace)).toBe(true);
  });
});
