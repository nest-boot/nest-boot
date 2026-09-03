import { PermissionAbilityBuilder } from '@nest-boot/auth';

import { ApiKey } from '../../../app/api-key/api-key.entity.js';
import { Session } from '../../../app/auth/entities/session.entity.js';
import { User } from '../../../app/user/user.entity.js';
import { Workspace } from '../../../app/workspace/workspace.entity.js';
import { WorkspaceMemberStatus } from '../../../app/workspace-member/enums/workspace-member-status.enum.js';
import { WorkspaceInvitation } from '../../../app/workspace-member/workspace-invitation.entity.js';
import { WorkspaceMember } from '../../../app/workspace-member/workspace-member.entity.js';

/** Builds permissions that belong to an authenticated user. */
export function buildUserPermissionAbility(permissions: readonly string[]) {
  const { can, build } = new PermissionAbilityBuilder();

  can('read', User);
  can('read', Workspace);
  can('create', Workspace);
  can(['read', 'update'], WorkspaceInvitation);
  can(['read', 'update'], WorkspaceMember);
  can('manage', ApiKey);

  addPermissions(can, permissions, {
    session: Session,
    user: User,
  });

  return build();
}

/** Builds permissions granted by the current workspace membership. */
export function buildWorkspaceMemberPermissionAbility(
  permissions: readonly string[],
  workspaceMember?: WorkspaceMember | null,
) {
  const { can, build } = new PermissionAbilityBuilder();

  if (workspaceMember?.status !== WorkspaceMemberStatus.ACTIVE) {
    return build();
  }

  can('read', User);
  can('read', Workspace);
  can('read', WorkspaceInvitation);
  can('read', WorkspaceMember);

  addPermissions(can, permissions, {
    apiKey: ApiKey,
    workspace: Workspace,
    workspaceInvitation: WorkspaceInvitation,
    workspaceMember: WorkspaceMember,
  });

  return build();
}

function addPermissions(
  can: PermissionAbilityBuilder['can'],
  permissions: readonly string[],
  subjects: Record<string, Parameters<PermissionAbilityBuilder['can']>[1]>,
): void {
  for (const permission of new Set(permissions)) {
    const [resource, action] = permission.split(':');
    const subject = subjects[resource];

    if (subject && action) {
      can(action, subject);
    }
  }
}
