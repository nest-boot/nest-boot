import { RequestContext } from '@nest-boot/request-context';
import { createParamDecorator } from '@nestjs/common';

import { WorkspaceMember } from '../../app/workspace-member/workspace-member.entity.js';

/** 从请求上下文中读取当前工作区成员的参数装饰器。 */
export const CurrentWorkspaceMember = createParamDecorator(() =>
  RequestContext.get(WorkspaceMember),
);
