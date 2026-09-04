import type { AbilityBuilder } from '@casl/ability';
import { UserAbility, WorkspaceAbility } from '@nest-boot/auth';

import { ApiKey } from '../../../app/api-key/api-key.entity.js';
import { Session } from '../../../app/auth/entities/session.entity.js';
import { User } from '../../../app/user/user.entity.js';
import { Workspace } from '../../../app/workspace/workspace.entity.js';
import { WorkspaceInvitation } from '../../../app/workspace-member/workspace-invitation.entity.js';
import { WorkspaceMember } from '../../../app/workspace-member/workspace-member.entity.js';

/** Builds permissions that belong to an authenticated user. */
export function buildUserPermissionAbility(
  builder: AbilityBuilder<UserAbility>,
  permissions: readonly string[],
) {
  const { can, build } = builder;

  can('read', User);
  can('read', Workspace);
  can('create', Workspace);
  can(['read', 'update'], WorkspaceInvitation);
  can(['read', 'update'], WorkspaceMember);
  can('manage', ApiKey);

  const subjects = {
    session: Session,
    user: User,
  } as const;

  for (const permission of new Set(permissions)) {
    const [resource, action] = permission.split(':');
    const subject = subjects[resource as keyof typeof subjects];
    if (subject && action) can(action, subject);
  }

  return build();
}

/** Builds permissions resolved for the current workspace. */
export function buildWorkspacePermissionAbility(
  builder: AbilityBuilder<WorkspaceAbility>,
  permissions: readonly string[],
) {
  const { can, build } = builder;

  can('read', User);
  can('read', Workspace);
  can('read', WorkspaceInvitation);
  can('read', WorkspaceMember);

  const subjects = {
    apiKey: ApiKey,
    workspace: Workspace,
    workspaceInvitation: WorkspaceInvitation,
    workspaceMember: WorkspaceMember,
  } as const;

  for (const permission of new Set(permissions)) {
    const [resource, action] = permission.split(':');
    const subject = subjects[resource as keyof typeof subjects];
    if (subject && action) can(action, subject);
  }

  return build();
}
