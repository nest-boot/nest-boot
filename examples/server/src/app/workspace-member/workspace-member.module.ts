import { Module } from '@nestjs/common';

import { UserModule } from '../user/user.module.js';
import { WorkspaceMemberResolver } from './workspace-member.resolver.js';
import { WorkspaceMemberService } from './workspace-member.service.js';

/** 工作区成员模块。 */
@Module({
  imports: [UserModule],
  providers: [WorkspaceMemberService, WorkspaceMemberResolver],
  exports: [WorkspaceMemberService],
})
export class WorkspaceMemberModule {}
