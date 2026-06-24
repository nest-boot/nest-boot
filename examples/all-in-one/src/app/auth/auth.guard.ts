import { AuthGuard as BaseAuthGuard } from '@nest-boot/auth';
import { RequestContext } from '@nest-boot/request-context';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

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
   * 创建认证守卫。
   *
   * @param reflector - Nest 元数据反射器。
   */
  constructor(protected override readonly reflector: Reflector) {
    super(reflector);
  }

  /**
   * 判断当前请求是否允许进入路由处理。
   *
   * @param context - Nest 当前执行上下文。
   * @returns 请求是否通过认证。
   */
  override canActivate(context: ExecutionContext) {
    return !!RequestContext.get(WorkspaceMember) || super.canActivate(context);
  }
}
