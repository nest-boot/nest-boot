import {
  getPolicyMetadata,
  PolicyCommand,
  PolicyMode,
} from '@nest-boot/row-level-security';

import { Workspace } from './workspace.entity.js';

describe('Workspace', () => {
  it('does not inherit from a workspace base entity', () => {
    expect(Object.getPrototypeOf(Workspace.prototype)).toBe(Object.prototype);
  });

  it('uses restrictive row-level security policies for soft deletion', () => {
    expect(getPolicyMetadata(Workspace)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'soft_delete_select_policy',
          mode: PolicyMode.RESTRICTIVE,
          command: PolicyCommand.SELECT,
          using: '"deleted_at" is null',
        }),
        expect.objectContaining({
          name: 'soft_delete_update_policy',
          mode: PolicyMode.RESTRICTIVE,
          command: PolicyCommand.UPDATE,
          using: '"deleted_at" is null',
          withCheck: '(true)',
        }),
        expect.objectContaining({
          name: 'soft_delete_delete_policy',
          mode: PolicyMode.RESTRICTIVE,
          command: PolicyCommand.DELETE,
          using: '(false)',
        }),
      ]),
    );
  });

  it('allows public workspace reads through row-level security', () => {
    expect(getPolicyMetadata(Workspace)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'workspace_select_policy',
          command: PolicyCommand.SELECT,
          using: '(true)',
          roles: ['authenticated', 'anonymous'],
        }),
      ]),
    );
  });
});
