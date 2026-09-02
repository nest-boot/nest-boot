import { AuthGuard as BaseAuthGuard } from '@nest-boot/auth';
import { RequestContext } from '@nest-boot/request-context';
import { Injectable } from '@nestjs/common';

import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';

/**
 * 应用级认证守卫。
 *
 * @remarks
 * 普通会话请求交给 `@nest-boot/auth` 的基础守卫处理；API Key 请求会在中间件阶段写入 `WorkspaceMember`，因此这里也把已解析出工作区成员的请求视为已认证。
 */
@Injectable()
export class AuthGuard extends BaseAuthGuard {
  /**
   * 判断当前请求是否已通过会话或 API Key 认证。
   * @returns 当前请求是否已认证。
   */
  protected override isAuthenticated(): boolean {
    return !!RequestContext.get(WorkspaceMember) || super.isAuthenticated();
  }
}
