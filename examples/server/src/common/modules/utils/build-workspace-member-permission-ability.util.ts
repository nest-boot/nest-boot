import { PermissionAbilityBuilder } from '@nest-boot/auth';

import { ApiKey } from '../../../app/api-key/api-key.entity.js';
import { Session } from '../../../app/auth/entities/session.entity.js';
import { WorkspacePermission } from '../../../app/auth/enums/workspace-permission.enum.js';
import type { AuthPermission } from '../../../app/auth/types/auth-permission.type.js';
import { User } from '../../../app/user/user.entity.js';
import { Workspace } from '../../../app/workspace/workspace.entity.js';
import { WorkspaceMemberRole } from '../../../app/workspace-member/enums/workspace-member-role.enum.js';
import { WorkspaceMemberStatus } from '../../../app/workspace-member/enums/workspace-member-status.enum.js';
import { WorkspaceInvitation } from '../../../app/workspace-member/workspace-invitation.entity.js';
import { WorkspaceMember } from '../../../app/workspace-member/workspace-member.entity.js';

/** Builds permissions that belong to an authenticated user. */
export function buildUserPermissionAbility(permissions: AuthPermission[]) {
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
  permissions: WorkspacePermission[],
  workspaceMember?: WorkspaceMember | null,
) {
  const { can, cannot, build } = new PermissionAbilityBuilder();

  can('read', User);
  can('read', Workspace);
  can('read', WorkspaceMember);

  if (workspaceMember?.status !== WorkspaceMemberStatus.ACTIVE) {
    return build();
  }

  can('update', WorkspaceMember);

  if (workspaceMember.role === WorkspaceMemberRole.OWNER) {
    can('manage', 'all');
    cannot('update', 'Workspace', {
      id: { $ne: workspaceMember.workspace.id },
    });
    cannot('delete', 'Workspace', {
      id: { $ne: workspaceMember.workspace.id },
    });
  } else if (workspaceMember.role === WorkspaceMemberRole.ADMIN) {
    can('manage', 'all');
    cannot('manage', ApiKey);
    cannot('delete', Workspace);
    cannot('update', 'Workspace', {
      id: { $ne: workspaceMember.workspace.id },
    });
  } else {
    can('read', 'all');
    cannot('read', ApiKey);
  }

  addPermissions(can, permissions, {
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
