vi.mock('@nest-boot/auth', () => ({
  BaseUser: class BaseUser {},
}));

import {
  getPolicyDefinitions,
  PolicyCommand,
} from '@nest-boot/row-level-security';

import { ApiKey } from './api-key.entity.js';

describe('ApiKey', () => {
  it('uses a simple workspace row-level security policy', () => {
    const policies = getPolicyDefinitions(ApiKey, {
      entityName: 'ApiKey',
      schemaName: 'public',
      tableName: 'api_key',
      properties: {
        workspace: {
          fieldNames: ['workspace_id'],
          columnTypes: ['bigint'],
        },
      },
    });

    expect(policies).toHaveLength(1);
    expect(policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'api_key_workspace_all_authenticated_policy',
          command: PolicyCommand.ALL,
          roles: ['authenticated'],
          using: expect.stringContaining('workspace_id'),
          withCheck: expect.stringContaining('workspace_id'),
        }),
      ]),
    );
  });
});
