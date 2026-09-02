import { AuthMiddleware } from '@nest-boot/auth';
import { MiddlewareManager, MiddlewareModule } from '@nest-boot/middleware';
import { RequestContextMiddleware } from '@nest-boot/request-context';
import { Module } from '@nestjs/common';

import { WorkspaceMiddleware } from './workspace.middleware.js';
import { WorkspaceResolver } from './workspace.resolver.js';
import { WorkspaceService } from './workspace.service.js';

/**
 * 工作区功能模块。
 */
@Module({
  imports: [MiddlewareModule],
  providers: [WorkspaceMiddleware, WorkspaceResolver, WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {
  /**
   * 创建工作区模块并注册工作区中间件。
   *
   * @param middlewareManager - NestBoot 中间件管理器。
   * @param workspaceMiddleware - 工作区识别中间件。
   */
  constructor(
    private readonly middlewareManager: MiddlewareManager,
    private readonly workspaceMiddleware: WorkspaceMiddleware,
  ) {
    this.middlewareManager
      .apply(this.workspaceMiddleware)
      .dependencies(RequestContextMiddleware)
      .before(AuthMiddleware)
      .forRoutes('*');
  }
}
