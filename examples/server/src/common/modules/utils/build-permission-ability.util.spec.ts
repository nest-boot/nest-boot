vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
}));

import { AbilityBuilder } from '@casl/ability';
import { UserAbility, WorkspaceAbility } from '@nest-boot/auth';
import {
  Invitation,
  Member,
  User,
  UserApiKey,
  Workspace,
  WorkspaceApiKey,
} from '@nest-boot/auth';

import {
  buildUserPermissionAbility,
  buildWorkspacePermissionAbility,
} from './build-permission-ability.util.js';

describe('permission ability builders', () => {
  it('matches configured resource prefixes exactly without case aliases', () => {
    const userAbility = buildUserPermissionAbility(
      new AbilityBuilder(UserAbility),
      ['User:delete', 'UserApiKey:create'],
    );
    const workspaceAbility = buildWorkspacePermissionAbility(
      new AbilityBuilder(WorkspaceAbility),
      ['Workspace:delete', 'UserApiKey:create'],
    );
    expect(userAbility.can('delete', User)).toBe(false);
    expect(userAbility.can('create', UserApiKey)).toBe(false);
    expect(workspaceAbility.can('delete', Workspace)).toBe(false);
    expect(workspaceAbility.can('create', WorkspaceApiKey)).toBe(false);
  });
  it('does not grant private user reads from ordinary membership or workspace permissions', () => {
    expect(
      buildUserPermissionAbility(new AbilityBuilder(UserAbility), []).can(
        'read',
        User,
      ),
    ).toBe(false);
    expect(
      buildWorkspacePermissionAbility(new AbilityBuilder(WorkspaceAbility), [
        'user:get',
        'user:read',
      ]).can('read', User),
    ).toBe(false);
    for (const permission of ['user:get', 'user:list']) {
      expect(
        buildUserPermissionAbility(new AbilityBuilder(UserAbility), [
          permission,
        ]).can('read', User),
      ).toBe(true);
    }
  });
  it.each(['read', 'create', 'update', 'delete'])(
    'grants only the requested API-key %s action',
    (action) => {
      for (const build of [
        buildUserPermissionAbility,
        buildWorkspacePermissionAbility,
      ]) {
        const ability =
          build === buildUserPermissionAbility
            ? buildUserPermissionAbility(new AbilityBuilder(UserAbility), [
                `api-key:${action}`,
              ])
            : buildWorkspacePermissionAbility(
                new AbilityBuilder(WorkspaceAbility),
                [`api-key:${action}`],
              );
        for (const candidate of ['read', 'create', 'update', 'delete']) {
          expect(
            ability.can(
              candidate,
              build === buildUserPermissionAbility
                ? UserApiKey
                : WorkspaceApiKey,
            ),
          ).toBe(candidate === action);
        }
      }
    },
  );
  it('does not grant key management to an empty-permission API key', () => {
    const ability = buildUserPermissionAbility(
      new AbilityBuilder(UserAbility),
      [],
    );
    for (const action of ['read', 'create', 'update', 'delete']) {
      expect(ability.can(action, UserApiKey)).toBe(false);
    }
  });
  it('builds user permissions independently of workspace membership', () => {
    const ability = buildUserPermissionAbility(
      new AbilityBuilder(UserAbility),
      ['user:delete'],
    );

    expect(ability.can('read', User)).toBe(false);
    expect(ability.can('create', Workspace)).toBe(true);
    expect(ability.can('manage', UserApiKey)).toBe(false);
    expect(ability.can('delete', Workspace)).toBe(false);
    expect(ability.can('delete', User)).toBe(true);
  });

  it('builds baseline workspace rules from an empty resolved permission list', () => {
    const ability = buildWorkspacePermissionAbility(
      new AbilityBuilder(WorkspaceAbility),
      [],
    );

    expect(ability.can('read', Workspace)).toBe(true);
    expect(ability.can('read', Member)).toBe(true);
    expect(ability.can('update', Workspace)).toBe(false);
  });

  it('builds workspace rules from permissions resolved by the guard', () => {
    const ability = buildWorkspacePermissionAbility(
      new AbilityBuilder(WorkspaceAbility),
      [
        'workspace:update',
        'workspace:delete',
        'api-key:create',
        'api-key:update',
        'api-key:delete',
      ],
    );

    expect(ability.can('create', WorkspaceApiKey)).toBe(true);
    expect(ability.can('update', WorkspaceApiKey)).toBe(true);
    expect(ability.can('delete', WorkspaceApiKey)).toBe(true);
    expect(ability.can('delete', Workspace)).toBe(true);
    expect(ability.can('read', Invitation)).toBe(true);
    expect(ability.can('update', Workspace)).toBe(true);
  });

  it('only grants the supplied resolved permissions', () => {
    const ability = buildWorkspacePermissionAbility(
      new AbilityBuilder(WorkspaceAbility),
      ['workspace:update', 'member:update'],
    );

    expect(ability.can('create', UserApiKey)).toBe(false);
    expect(ability.can('delete', Workspace)).toBe(false);
    expect(ability.can('update', Workspace)).toBe(true);
    expect(ability.can('update', Member)).toBe(true);
  });

  it('supports application-defined action strings', () => {
    const ability = buildWorkspacePermissionAbility(
      new AbilityBuilder(WorkspaceAbility),
      ['workspace:publish'],
    );

    expect(ability.can('publish', Workspace)).toBe(true);
  });

  it('preserves the case of application-defined action strings', () => {
    const ability = buildWorkspacePermissionAbility(
      new AbilityBuilder(WorkspaceAbility),
      ['workspace:PUBLISH'],
    );
    expect(ability.can('PUBLISH', Workspace)).toBe(true);
    expect(ability.can('publish', Workspace)).toBe(false);
  });
});
