import { MetadataStorage } from '@mikro-orm/core';
import { BaseWorkspace } from '@nest-boot/auth';

import { Workspace } from './workspace.entity.js';

describe('Workspace', () => {
  it('extends the auth workspace base entity', () => {
    expect(new Workspace()).toBeInstanceOf(BaseWorkspace);
  });

  it('uses restrictive row-level security policies for soft deletion', () => {
    expect(
      Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === Workspace,
      )?.policies,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'soft_delete_select_policy',
          type: 'restrictive',
          command: 'select',
          using: '"deleted_at" is null',
        }),
        expect.objectContaining({
          name: 'soft_delete_update_policy',
          type: 'restrictive',
          command: 'update',
          using: '"deleted_at" is null',
          check: '(true)',
        }),
        expect.objectContaining({
          name: 'soft_delete_delete_policy',
          type: 'restrictive',
          command: 'delete',
          using: '(false)',
        }),
      ]),
    );
  });

  it('allows public workspace reads through row-level security', () => {
    expect(
      Object.values(MetadataStorage.getMetadata()).find(
        (meta) => meta.class === Workspace,
      )?.policies,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'workspace_select_policy',
          command: 'select',
          using: '(true)',
          roles: ['authenticated', 'anonymous'],
        }),
      ]),
    );
  });
});
