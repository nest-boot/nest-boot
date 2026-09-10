vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
}));

import { MetadataStorage } from '@mikro-orm/core';
import { BaseWorkspaceMember } from '@nest-boot/auth';

import { WorkspaceMemberType } from './enums/workspace-member-type.enum.js';
import { WorkspaceMember } from './workspace-member.entity.js';

describe('WorkspaceMember', () => {
  it('extends the auth workspace-member base entity', () => {
    expect(new WorkspaceMember()).toBeInstanceOf(BaseWorkspaceMember);
  });

  it('defaults to a user member', () => {
    const member = new WorkspaceMember();

    expect(member.type).toBe(WorkspaceMemberType.USER);
    expect(member.permissions).toEqual([]);
  });

  it('uses simple workspace and user row-level security policies', () => {
    const policies = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === WorkspaceMember,
    )?.policies;

    expect(policies).toHaveLength(2);
    expect(policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'all',
          roles: ['authenticated'],
          using: expect.any(Function),
          check: expect.any(Function),
        }),
        expect.objectContaining({
          command: 'all',
          roles: ['authenticated'],
          using: expect.any(Function),
          check: expect.any(Function),
        }),
      ]),
    );
  });
});
