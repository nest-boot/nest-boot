import { AuthMiddleware } from '@nest-boot/auth';
import { MiddlewareManager, MiddlewareModule } from '@nest-boot/middleware';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { WorkspaceMiddleware } from '../workspace/workspace.middleware.js';
import { WorkspaceMemberModule } from '../workspace-member/workspace-member.module.js';
import { ApiKeyMiddleware } from './api-key.middleware.js';
import { ApiKeyResolver } from './api-key.resolver.js';
import { ApiKeyService } from './api-key.service.js';
import { ApiKeyUsageInterceptor } from './api-key-usage.interceptor.js';

/**
 * API Key 功能模块。
 */
@Module({
  imports: [MiddlewareModule, WorkspaceMemberModule],
  providers: [
    ApiKeyMiddleware,
    ApiKeyUsageInterceptor,
    ApiKeyService,
    ApiKeyResolver,
    {
      provide: APP_INTERCEPTOR,
      useExisting: ApiKeyUsageInterceptor,
    },
  ],
  exports: [ApiKeyService],
})
export class ApiKeyModule {
  /**
   * 创建 API Key 模块并注册 API Key 中间件。
   *
   * @param middlewareManager - NestBoot 中间件管理器。
   * @param apiKeyMiddleware - API Key 认证中间件。
   */
  constructor(
    private readonly middlewareManager: MiddlewareManager,
    private readonly apiKeyMiddleware: ApiKeyMiddleware,
  ) {
    this.middlewareManager
      .apply(this.apiKeyMiddleware)
      .dependencies(WorkspaceMiddleware)
      .after(AuthMiddleware)
      .forRoutes('*');
  }
}
