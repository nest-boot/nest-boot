import { PermissionGuard } from '@nest-boot/permission';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { CommonModule } from '../common/common.module.js';
import { ApiKeyModule } from './api-key/api-key.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';
import { WorkspaceMemberModule } from './workspace-member/workspace-member.module.js';
import { WorkspaceMemberGroupModule } from './workspace-member-group/workspace-member-group.module.js';
import { WorkspaceMemberGroupMemberModule } from './workspace-member-group-member/workspace-member-group-member.module.js';

/** 服务端根模块。 */
@Module({
  imports: [
    CommonModule,
    AuthModule,
    ApiKeyModule,
    UserModule,
    WorkspaceModule,
    WorkspaceMemberModule,
    WorkspaceMemberGroupModule,
    WorkspaceMemberGroupMemberModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useExisting: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: PermissionGuard,
    },
  ],
})
export class AppModule {}
