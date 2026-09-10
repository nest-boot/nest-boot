import { EntityManager } from '@mikro-orm/core';
import { RequestContext } from '@nest-boot/request-context';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { ApiKey } from '../api-key/api-key.entity.js';
import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';

/**
 * 将请求上下文同步到行级安全运行时。
 */
@Injectable()
export class RowLevelSecurityInterceptor implements NestInterceptor {
  /**
   * 创建原生 RLS 请求拦截器。
   * @param em - 当前请求作用域的实体管理器。
   */
  constructor(private readonly em: EntityManager) {}

  /**
   * 根据当前请求上下文设置 RLS 用户、工作区和认证角色。
   *
   * @param _context - Nest 当前执行上下文。
   * @param next - 后续调用处理器。
   * @returns 原始响应流。
   */
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (RequestContext.isActive()) {
      const user = RequestContext.get(User);
      const apiKey = RequestContext.get(ApiKey);
      const workspace = RequestContext.get(Workspace);
      const workspaceMember = RequestContext.get(WorkspaceMember);
      const authenticated = Boolean(user || apiKey || workspaceMember);
      const canUseWorkspace = Boolean(workspaceMember || (apiKey && !user));

      this.em.setSessionContext({
        variables: {
          'app.user_id': user?.id ?? '',
          'app.workspace':
            !authenticated || canUseWorkspace ? (workspace?.id ?? '') : '',
        },
        role: authenticated ? 'authenticated' : 'anonymous',
      });
    }

    return next.handle();
  }
}
