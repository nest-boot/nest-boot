vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
}));

import { MetadataStorage } from '@mikro-orm/core';
import { BaseApiKey } from '@nest-boot/auth';

import { ApiKey } from './api-key.entity.js';

describe('ApiKey', () => {
  it('extends the auth API-key base entity', () => {
    expect(new ApiKey()).toBeInstanceOf(BaseApiKey);
  });

  it('uses Better Auth compatible defaults for optional API-key fields', () => {
    const apiKey = new ApiKey();

    expect(apiKey.enabled).toBe(true);
    expect(apiKey.permissions).toEqual([]);
  });

  it('uses the same owner-scope predicate for reads and writes', () => {
    const policies = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === ApiKey,
    )?.policies;

    expect(policies).toEqual([
      {
        command: 'all',
        roles: ['authenticated'],
        using: expect.any(Function),
        check: expect.any(Function),
      },
    ]);
    expect(policies?.[0].using).toBe(policies?.[0].check);
  });
});
