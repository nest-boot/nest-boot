import { Module } from '@nestjs/common';

import { WorkspaceInvitationResolver } from './workspace-invitation.resolver.js';
import { WorkspaceMemberResolver } from './workspace-member.resolver.js';
import { WorkspaceMemberService } from './workspace-member.service.js';

/** 工作区成员模块。 */
@Module({
  providers: [
    WorkspaceInvitationResolver,
    WorkspaceMemberService,
    WorkspaceMemberResolver,
  ],
  exports: [WorkspaceMemberService],
})
export class WorkspaceMemberModule {}
