import { RequestContext } from '@nest-boot/request-context';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { ApiKey } from './api-key.entity.js';
import { ApiKeyService } from './api-key.service.js';
import { extractApiKey } from './utils/extract-api-key.util.js';

/**
 * 解析并验证请求中的接口密钥。
 *
 * @remarks
 * 接口密钥校验成功后，会把 `ApiKey` 和它对应的 `WorkspaceMember` 写入 `RequestContext`，供后续守卫、权限能力构建和拦截器使用。
 * 同时会把 API Key 绑定的工作区写入 `RequestContext`，因此 API Key 调用方不需要再额外传递 `x-workspace-id`。
 *
 * 中间件本身不设置行级安全（RLS）的角色与上下文；行级安全状态由后续统一的拦截器根据请求上下文计算。
 */
@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  /**
   * 创建接口密钥中间件。
   *
   * @param apiKeyService - 接口密钥创建、校验和持久化服务。
   */
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * 从请求中提取接口密钥，并根据密钥自身的绑定关系恢复工作区上下文。
   *
   * @param req - Express 请求对象，用于从请求头中提取接口密钥。
   * @param _res - Express 响应对象，此中间件不会直接写响应。
   * @param next - Nest 与 Express 中间件链的后续处理函数。
   */
  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const apiKey = extractApiKey(req);

      if (apiKey) {
        const {
          apiKey: entity,
          workspace,
          workspaceMember,
        } = await this.apiKeyService.validate(apiKey);

        RequestContext.set(ApiKey, entity);
        RequestContext.set(Workspace, workspace);
        RequestContext.set(WorkspaceMember, workspaceMember);
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
