vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
}));

import { MetadataStorage } from '@mikro-orm/core';
import { Member as BaseMember } from '@nest-boot/auth';
import { Member } from '@nest-boot/auth';

describe('Member', () => {
  it('extends the auth member base entity', () => {
    expect(new Member()).toBeInstanceOf(BaseMember);
  });

  it('keeps workspace-visible profile fields without a member type', () => {
    const member = new Member();

    expect(member).not.toHaveProperty('type');
    expect(member.email).toBeNull();
    expect(member.permissions).toEqual([]);
  });
  it('combines own-membership reads with workspace isolation', () => {
    const policies = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === Member,
    )?.policies;

    expect(policies).toHaveLength(2);
    expect(policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'select',
          roles: ['authenticated'],
          using: expect.any(Function),
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

  it('requires unique membership identities, not contact emails', () => {
    const uniques = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === Member,
    )?.uniques;

    expect(uniques).toEqual([
      expect.objectContaining({ properties: ['user', 'workspace'] }),
    ]);
  });
});
