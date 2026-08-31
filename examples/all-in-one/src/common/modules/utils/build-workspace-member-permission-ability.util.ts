import {
  PermissionAbilityBuilder,
  PermissionAction,
} from '@nest-boot/permission';
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

/**
 * 基于当前工作区成员角色和有效权限构建 CASL 权限能力。
 *
 * @param permissions - 当前工作区成员的有效权限列表。
 * @returns 可用于权限守卫判断的能力对象。
 */
export function buildWorkspaceMemberPermissionAbility(
  permissions: WorkspaceMemberPermission[],
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

  if (permissions.includes(WorkspaceMemberPermission.MANAGE_WORKSPACE)) {
    can(PermissionAction.MANAGE, Workspace);
    can(PermissionAction.MANAGE, 'Workspace', {
      id: workspaceMember.workspace.id,
    });
  }

  if (permissions.includes(WorkspaceMemberPermission.MANAGE_MEMBERS)) {
    can(PermissionAction.MANAGE, WorkspaceMember);
    can(PermissionAction.MANAGE, WorkspaceMemberGroup);
    can(PermissionAction.MANAGE, WorkspaceMemberGroupMember);
  }

  return build();
}
