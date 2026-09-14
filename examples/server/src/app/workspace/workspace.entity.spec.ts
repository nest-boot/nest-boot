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
          type: 'restrictive',
          command: 'all',
          using: expect.any(Function),
          check: expect.any(Function),
        }),
        expect.objectContaining({
          type: 'restrictive',
          command: 'delete',
          using: expect.any(Function),
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
          command: 'select',
          using: expect.any(Function),
          roles: ['authenticated', 'anonymous'],
        }),
      ]),
    );
  });
});
