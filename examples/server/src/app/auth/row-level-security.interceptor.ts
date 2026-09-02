import { RequestContext } from '@nest-boot/request-context';
import { RowLevelSecurity } from '@nest-boot/row-level-security';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';

/**
 * 将请求上下文同步到行级安全运行时。
 */
@Injectable()
export class RowLevelSecurityInterceptor implements NestInterceptor {
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
      const workspace = RequestContext.get(Workspace);
      const workspaceMember = RequestContext.get(WorkspaceMember);

      if (user) {
        RowLevelSecurity.setContext('user_id', user.id);
      }

      if (workspace) {
        RowLevelSecurity.setContext('workspace_id', workspace.id);
      }

      if (user || workspaceMember) {
        RowLevelSecurity.setRole('authenticated');
      }
    }

    return next.handle();
  }
}
