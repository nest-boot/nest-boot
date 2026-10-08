import type { PolicyCallback } from '@mikro-orm/core';
import { Entity } from '@mikro-orm/decorators/legacy';
import { JobEntity } from '@nest-boot/bullmq-mikro-orm';

const matchesJobIdentity: PolicyCallback<Job> = (columns) =>
  `("${columns.data}" ->> 'userId' = nullif(current_setting('app.user.id', true), '') OR "${columns.data}" ->> 'workspaceId' = nullif(current_setting('app.workspace.id', true), ''))`;

/** 跨队列任务记录：data 中的用户或工作区任意匹配即可访问。 */
@Entity({
  policies: [
    {
      command: 'all',
      roles: ['authenticated'],
      using: matchesJobIdentity,
      check: matchesJobIdentity,
    },
  ],
})
export class Job extends JobEntity {}
