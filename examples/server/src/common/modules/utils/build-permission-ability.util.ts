import type { AbilityBuilder } from '@casl/ability';
import { UserAbility, WorkspaceAbility } from '@nest-boot/auth';
import {
  ApiKey,
  Invitation,
  Member,
  Session,
  User,
  Workspace,
} from '@nest-boot/auth';

/** Builds permissions that belong to an authenticated user. */
export function buildUserPermissionAbility(
  builder: AbilityBuilder<UserAbility>,
  permissions: readonly string[],
) {
  const { can, build } = builder;

  can('read', Workspace);
  can('create', Workspace);
  can(['read', 'update'], Invitation);
  can(['read', 'update'], Member);

  const subjects = {
    'api-key': ApiKey,
    session: Session,
    user: User,
  } as const;

  for (const permission of new Set(permissions)) {
    const [resource, action] = permission.split(':');
    const subject = subjects[resource as keyof typeof subjects];
    if (subject && action) can(action, subject);
    if (resource === 'user' && (action === 'get' || action === 'list')) {
      can('read', User);
    }
  }

  return build();
}

/** Builds permissions resolved for the current workspace. */
export function buildWorkspacePermissionAbility(
  builder: AbilityBuilder<WorkspaceAbility>,
  permissions: readonly string[],
) {
  const { can, build } = builder;

  can('read', Workspace);
  can('read', Invitation);
  can('read', Member);

  const subjects = {
    'api-key': ApiKey,
    workspace: Workspace,
    invitation: Invitation,
    member: Member,
  } as const;

  for (const permission of new Set(permissions)) {
    const [resource, action] = permission.split(':');
    const subject = subjects[resource as keyof typeof subjects];
    if (subject && action) can(action, subject);
  }

  return build();
}
