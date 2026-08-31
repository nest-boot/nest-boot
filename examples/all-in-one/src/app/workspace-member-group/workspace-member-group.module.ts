import { Module } from '@nestjs/common';

import { WorkspaceMemberModule } from '../workspace-member/workspace-member.module.js';
import { WorkspaceMemberGroupResolver } from './workspace-member-group.resolver.js';
import { WorkspaceMemberGroupService } from './workspace-member-group.service.js';

/** 工作区成员组模块。 */
@Module({
  imports: [WorkspaceMemberModule],
  providers: [WorkspaceMemberGroupResolver, WorkspaceMemberGroupService],
  exports: [WorkspaceMemberGroupService],
})
export class WorkspaceMemberGroupModule {}
