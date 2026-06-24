import { PermissionModule as CorePermissionModule } from '@nest-boot/permission';
import { RequestContext } from '@nest-boot/request-context';

import { WorkspaceMember } from '../../app/workspace-member/workspace-member.entity.js';
import { WorkspaceMemberModule } from '../../app/workspace-member/workspace-member.module.js';
import { WorkspaceMemberService } from '../../app/workspace-member/workspace-member.service.js';
import { buildWorkspaceMemberPermissionAbility } from './utils/build-workspace-member-permission-ability.util.js';

/** 绑定当前工作区成员权限来源的动态权限模块。 */
export const PermissionModule = CorePermissionModule.forRootAsync({
  imports: [WorkspaceMemberModule],
  inject: [WorkspaceMemberService],
  useFactory: (workspaceMemberService: WorkspaceMemberService) => {
    return {
      buildAbility: async () => {
        const workspaceMember = RequestContext.get(WorkspaceMember);
        const permissions = workspaceMember
          ? await workspaceMemberService.getPermissions(workspaceMember)
          : [];

        return buildWorkspaceMemberPermissionAbility(permissions);
      },
    };
  },
});
