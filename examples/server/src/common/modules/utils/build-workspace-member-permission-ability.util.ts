import { PermissionAbilityBuilder, PermissionAction } from '@nest-boot/auth';
import { RequestContext } from '@nest-boot/request-context';

import { ApiKey } from '../../../app/api-key/api-key.entity.js';
import { User } from '../../../app/user/user.entity.js';
import { Workspace } from '../../../app/workspace/workspace.entity.js';
import { WorkspaceMemberRole } from '../../../app/workspace-member/enums/workspace-member-role.enum.js';
import { WorkspaceMemberStatus } from '../../../app/workspace-member/enums/workspace-member-status.enum.js';
import { WorkspaceMember } from '../../../app/workspace-member/workspace-member.entity.js';

/**
 * 基于当前工作区成员角色和有效权限构建 CASL 权限能力。
 *
 * @param permissions - 当前工作区成员按资源和操作分组的有效权限。
 * @returns 可用于权限守卫判断的能力对象。
 */
export function buildWorkspaceMemberPermissionAbility(
  permissions: Record<string, string[]>,
) {
  const workspaceMember = RequestContext.get(WorkspaceMember);
  const { can, cannot, build } = new PermissionAbilityBuilder();

  can(PermissionAction.READ, User);
  can(PermissionAction.READ, Workspace);
  can(PermissionAction.READ, WorkspaceMember);
  can(PermissionAction.CREATE, Workspace);
  can(PermissionAction.UPDATE, WorkspaceMember);

  if (
    !workspaceMember ||
    workspaceMember.status === WorkspaceMemberStatus.DISABLED
  ) {
    return build();
  }

  can(PermissionAction.CREATE, ApiKey);

  if (workspaceMember.role === WorkspaceMemberRole.OWNER) {
    can(PermissionAction.MANAGE, 'all');
    cannot(PermissionAction.UPDATE, 'Workspace', {
      id: { $ne: workspaceMember.workspace.id },
    });
    cannot(PermissionAction.DELETE, 'Workspace', {
      id: { $ne: workspaceMember.workspace.id },
    });
  } else if (workspaceMember.role === WorkspaceMemberRole.ADMIN) {
    can(PermissionAction.MANAGE, 'all');
    cannot(PermissionAction.DELETE, Workspace);
    cannot(PermissionAction.UPDATE, 'Workspace', {
      id: { $ne: workspaceMember.workspace.id },
    });
  } else {
    can(PermissionAction.READ, 'all');
  }

  const workspaceActions = getPermissionActions(permissions.workspace);

  if (workspaceActions.length > 0) {
    can(workspaceActions, Workspace);
    can(workspaceActions, 'Workspace', {
      id: workspaceMember.workspace.id,
    });
  }

  const workspaceMemberActions = getPermissionActions(
    permissions.workspaceMember,
  );

  if (workspaceMemberActions.length > 0) {
    can(workspaceMemberActions, WorkspaceMember);
  }

  return build();
}

function getPermissionActions(actions?: string[]): PermissionAction[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  const supportedActions = new Set<string>(Object.values(PermissionAction));

  return Array.from(new Set(actions)).filter(
    (action): action is PermissionAction => supportedActions.has(action),
  );
}
