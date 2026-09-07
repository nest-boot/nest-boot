import { Module } from '@nestjs/common';

import { WorkspaceInvitationResolver } from './workspace-invitation.resolver.js';
import { WorkspaceMemberResolver } from './workspace-member.resolver.js';

/** 工作区成员模块。 */
@Module({
  providers: [WorkspaceInvitationResolver, WorkspaceMemberResolver],
})
export class WorkspaceMemberModule {}
