import type { ForkOptions } from '@mikro-orm/core';
import { cookies, headers, RequestContext } from '@nest-boot/request-context';

/** 认证前的数据库 session：所选工作区与匿名角色。 */
export function createSessionContext(): ForkOptions['session'] {
  if (RequestContext.current().type !== 'http') return undefined;

  return {
    role: 'anonymous',
    variables: {
      'app.workspace': (
        headers().get('x-workspace-id') ??
        cookies().get('workspace_id')?.value ??
        ''
      ).trim(),
    },
  };
}
