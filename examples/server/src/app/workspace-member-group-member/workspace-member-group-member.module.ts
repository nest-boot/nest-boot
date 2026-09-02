import { Module } from '@nestjs/common';

import { WorkspaceMemberGroupMemberService } from './workspace-member-group-member.service.js';

/** 工作区成员组关系模块。 */
@Module({
  providers: [WorkspaceMemberGroupMemberService],
  exports: [WorkspaceMemberGroupMemberService],
})
export class WorkspaceMemberGroupMemberModule {}
