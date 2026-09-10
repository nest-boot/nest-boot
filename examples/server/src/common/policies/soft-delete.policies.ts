import type { PolicyDef } from '@mikro-orm/core';

/** 在实体 policies 中展开，限制软删除记录的读取与写入。 */
export const softDeletePolicies: PolicyDef[] = [
  {
    name: 'soft_delete_select_policy',
    type: 'restrictive',
    command: 'select',
    using: '"deleted_at" is null',
  },
  {
    name: 'soft_delete_update_policy',
    type: 'restrictive',
    command: 'update',
    using: '"deleted_at" is null',
    check: '(true)',
  },
  {
    name: 'soft_delete_delete_policy',
    type: 'restrictive',
    command: 'delete',
    using: '(false)',
  },
];
