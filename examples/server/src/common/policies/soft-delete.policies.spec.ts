import { softDeletePolicies } from './soft-delete.policies.js';

describe('softDeletePolicies', () => {
  it('uses native restrictive policies without granting a database role', () => {
    expect(softDeletePolicies).toEqual([
      {
        type: 'restrictive',
        command: 'select',
        using: expect.any(Function),
      },
      {
        type: 'restrictive',
        command: 'update',
        using: expect.any(Function),
        check: expect.any(Function),
      },
      {
        type: 'restrictive',
        command: 'delete',
        using: expect.any(Function),
      },
    ]);
  });
});
