vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  BaseUser: class BaseUser {},
}));

import { BaseApiKey } from '@nest-boot/auth';
import { getPolicyDefinitions } from '@nest-boot/row-level-security';

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

  it('uses service authorization for its polymorphic owner', () => {
    const policies = getPolicyDefinitions(ApiKey, {
      entityName: 'ApiKey',
      schemaName: 'public',
      tableName: 'api_key',
      properties: {},
    });

    expect(policies).toEqual([]);
  });
});
