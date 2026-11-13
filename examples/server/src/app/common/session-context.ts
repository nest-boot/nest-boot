import type { ForkOptions } from '@mikro-orm/core';
import { RequestContext } from '@nest-boot/request-context';

/**
 * 认证前仅建立匿名数据库上下文；选择器由 AuthMiddleware 统一解析。
 * @returns Initial database role and scope variables for the request.
 */
export function createSessionContext(): ForkOptions['session'] {
  if (RequestContext.current().type !== 'http') {
    return undefined;
  }

  return {
    role: 'anonymous',
    variables: {
      'app.auth.user.id': '',
      'app.auth.workspace_member.id': '',
      'app.auth.workspace.id': '',
      'app.selected.workspace.id': '',
    },
  };
}
