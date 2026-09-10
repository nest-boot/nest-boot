import { softDeletePolicies } from './soft-delete.policies.js';

describe('softDeletePolicies', () => {
  it('uses native restrictive policies without granting a database role', () => {
    expect(softDeletePolicies).toEqual([
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
    ]);
  });
});
