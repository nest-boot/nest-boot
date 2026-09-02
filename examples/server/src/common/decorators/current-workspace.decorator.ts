import { RequestContext } from '@nest-boot/request-context';
import { createParamDecorator } from '@nestjs/common';

import { Workspace } from '../../app/workspace/workspace.entity.js';

/** 从请求上下文中读取当前工作区的参数装饰器。 */
export const CurrentWorkspace = createParamDecorator(() =>
  RequestContext.get(Workspace),
);
