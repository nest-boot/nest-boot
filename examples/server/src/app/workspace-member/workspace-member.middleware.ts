import { RequestContext } from '@nest-boot/request-context';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from './workspace-member.entity.js';
import { WorkspaceMemberService } from './workspace-member.service.js';

/**
 * 为普通登录请求补齐当前工作区成员上下文。
 *
 * @remarks
 * 该中间件依赖 `WorkspaceMiddleware` 提供当前工作区，也依赖 `ApiKeyMiddleware` 优先处理接口密钥场景。
 *
 * 若接口密钥已经写入 `WorkspaceMember`，这里会直接跳过，避免重复查询。
 *
 * 对于普通会话登录请求，会根据当前 `User` 和 `Workspace` 查找成员关系，并写入 `RequestContext`。
 *
 * 行级安全（RLS）状态仍由后续拦截器统一设置。
 */
@Injectable()
export class WorkspaceMemberMiddleware implements NestMiddleware {
  /**
   * 创建工作区成员中间件。
   *
   * @param workspaceMemberService - 工作区成员查询与权限相关服务。
   */
  constructor(
    private readonly workspaceMemberService: WorkspaceMemberService,
  ) {}

  /**
   * 根据当前用户和工作区解析当前工作区成员。
   *
   * @param _req - Express 请求对象，此中间件只读取请求上下文。
   * @param _res - Express 响应对象，此中间件不会直接写响应。
   * @param next - Nest 与 Express 中间件链的后续处理函数。
   */
  async use(_req: Request, _res: Response, next: NextFunction) {
    try {
      if (RequestContext.get(WorkspaceMember)) {
        next();
        return;
      }

      const user = RequestContext.get(User);
      const workspace = RequestContext.get(Workspace);

      if (user && workspace) {
        const workspaceMember = await this.workspaceMemberService.findOne({
          user,
          workspace,
        });

        if (workspaceMember) {
          RequestContext.set(WorkspaceMember, workspaceMember);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
