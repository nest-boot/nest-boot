import { EntityManager } from '@mikro-orm/postgresql';
import { RequestContext } from '@nest-boot/request-context';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { Workspace } from './workspace.entity.js';

/**
 * 根据请求中选择的工作区标识加载当前工作区。
 *
 * @remarks
 * 该中间件只负责识别 `x-workspace-id` 请求头或 `workspace_id` 浏览器 Cookie，并把未软删除的 `Workspace` 写入请求上下文。
 *
 * 行级安全（RLS）的角色与上下文由后续拦截器统一设置，避免在中间件阶段触发业务行级安全约束。
 */
@Injectable()
export class WorkspaceMiddleware implements NestMiddleware {
  /**
   * 创建工作区中间件。
   *
   * @param em - 当前请求使用的 MikroORM `EntityManager`。
   */
  constructor(private readonly em: EntityManager) {}

  /**
   * 解析当前请求选择的工作区，并写入 `RequestContext`。
   *
   * @param req - Express 请求对象，用于读取请求头和已解析的浏览器 Cookie。
   * @param _res - Express 响应对象，此中间件不会直接写响应。
   * @param next - Nest 与 Express 中间件链的后续处理函数。
   */
  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const headerWorkspaceId = req.headers['x-workspace-id'];
      const workspaceId = (
        (Array.isArray(headerWorkspaceId)
          ? headerWorkspaceId[0]
          : headerWorkspaceId) ?? req.cookies?.workspace_id
      )?.trim();

      if (workspaceId) {
        const workspace = await this.em.findOne(Workspace, {
          id: workspaceId,
          deletedAt: null,
        });

        if (workspace) {
          RequestContext.set(Workspace, workspace);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
