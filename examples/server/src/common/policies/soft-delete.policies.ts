import type { PolicyDef } from '@mikro-orm/core';

/** 在实体 policies 中展开，限制软删除记录的读取与写入。 */
export const softDeletePolicies: PolicyDef[] = [
  {
    type: 'restrictive',
    command: 'select',
    using: (columns) => `${columns.deletedAt} is null`,
  },
  {
    type: 'restrictive',
    command: 'update',
    using: (columns) => `${columns.deletedAt} is null`,
    check: () => 'true',
  },
  {
    type: 'restrictive',
    command: 'delete',
    using: () => 'false',
  },
];
