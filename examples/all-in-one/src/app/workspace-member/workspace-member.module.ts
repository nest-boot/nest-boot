import { AuthMiddleware } from '@nest-boot/auth';
import { MiddlewareManager, MiddlewareModule } from '@nest-boot/middleware';
import { Module } from '@nestjs/common';

import { ApiKeyMiddleware } from '../api-key/api-key.middleware.js';
import { UserModule } from '../user/user.module.js';
import { WorkspaceMiddleware } from '../workspace/workspace.middleware.js';
import { WorkspaceMemberMiddleware } from './workspace-member.middleware.js';
import { WorkspaceMemberResolver } from './workspace-member.resolver.js';
import { WorkspaceMemberService } from './workspace-member.service.js';

/** 工作区成员模块。 */
@Module({
  imports: [MiddlewareModule, UserModule],
  providers: [
    WorkspaceMemberMiddleware,
    WorkspaceMemberService,
    WorkspaceMemberResolver,
  ],
  exports: [WorkspaceMemberService],
})
export class WorkspaceMemberModule {
  /**
   * 注册工作区成员中间件。
   *
   * @param middlewareManager - 中间件编排器。
   * @param workspaceMemberMiddleware - 当前工作区成员解析中间件。
   */
  constructor(
    /** 中间件编排器。 */
    private readonly middlewareManager: MiddlewareManager,
    /** 当前工作区成员解析中间件。 */
    private readonly workspaceMemberMiddleware: WorkspaceMemberMiddleware,
  ) {
    this.middlewareManager
      .apply(this.workspaceMemberMiddleware)
      .dependencies(WorkspaceMiddleware)
      .after(AuthMiddleware, ApiKeyMiddleware)
      .forRoutes('*');
  }
}
