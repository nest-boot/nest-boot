import {
  getPolicyMetadata,
  PolicyCommand,
  PolicyMode,
} from '@nest-boot/row-level-security';

import { SoftDeletePolicy } from './soft-delete-policy.decorator.js';

describe('SoftDeletePolicy', () => {
  it('adds restrictive policies for soft-deleted rows without granting roles', () => {
    @SoftDeletePolicy()
    class SoftDeletedEntity {}

    expect(getPolicyMetadata(SoftDeletedEntity)).toEqual([
      {
        name: 'soft_delete_select_policy',
        mode: PolicyMode.RESTRICTIVE,
        command: PolicyCommand.SELECT,
        using: '"deleted_at" is null',
        roles: [],
      },
      {
        name: 'soft_delete_update_policy',
        mode: PolicyMode.RESTRICTIVE,
        command: PolicyCommand.UPDATE,
        using: '"deleted_at" is null',
        withCheck: '(true)',
        roles: [],
      },
      {
        name: 'soft_delete_delete_policy',
        mode: PolicyMode.RESTRICTIVE,
        command: PolicyCommand.DELETE,
        using: '(false)',
        roles: [],
      },
    ]);
  });
});
