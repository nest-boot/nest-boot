import type { ApiKeyService } from '@nest-boot/auth';
import type { Mocked } from 'vitest';

vi.mock('@nest-boot/auth', () => ({
  ApiKeyService: class ApiKeyService {},
  BaseUser: class BaseUser {},
  CurrentWorkspace: () => () => undefined,
  CurrentWorkspaceMember: () => () => undefined,
}));

vi.mock('@nest-boot/graphql-connection', () => ({
  ConnectionBuilder: class ConnectionBuilder {
    addField() {
      return this;
    }

    build() {
      return {
        Connection: class Connection {},
        ConnectionArgs: class ConnectionArgs {},
      };
    }
  },
  ConnectionManager: class ConnectionManager {},
}));

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { ApiKey } from './api-key.entity.js';
import { ApiKeyResolver } from './api-key.resolver.js';

describe('ApiKeyResolver', () => {
  it('delegates single-key access checks to the auth service', async () => {
    const member = { id: 'member_1' } as WorkspaceMember;
    const apiKey = { id: 'api_key_1' } as ApiKey;
    const { resolver, apiKeyService } = createResolver({
      getApiKey: vi.fn(async () => apiKey),
    });

    await expect(resolver.apiKey('api_key_1', member)).resolves.toBe(apiKey);
    expect(apiKeyService.getApiKey).toHaveBeenCalledWith('api_key_1', member);
  });

  it('uses the auth service list filter for connection pagination', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const member = { id: 'member_1' } as WorkspaceMember;
    const where = { workspace, member };
    const args = { first: 10 } as never;
    const { resolver, apiKeyService, cm } = createResolver({
      getListFilter: vi.fn(() => where),
    });

    await resolver.apiKeys(args, workspace, member);

    expect(apiKeyService.getListFilter).toHaveBeenCalledWith(workspace, member);
    expect(cm.find).toHaveBeenCalledWith(expect.any(Function), args, { where });
  });

  it('delegates API-key creation to the auth service', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const member = { id: 'member_1' } as WorkspaceMember;
    const result = {
      entity: { id: 'api_key_1' } as ApiKey,
      apiKey: 'sk-0123456789abcdefabcdef0123456789',
    };
    const { resolver, apiKeyService } = createResolver({
      createKey: vi.fn(async () => result),
    });

    await expect(
      resolver.createApiKey({ name: 'Deploy key' }, workspace, member),
    ).resolves.toBe(result);
    expect(apiKeyService.createKey).toHaveBeenCalledWith(workspace, member, {
      name: 'Deploy key',
      expiresAt: null,
    });
  });

  it('delegates API-key updates and deletion to the auth service', async () => {
    const member = { id: 'member_1' } as WorkspaceMember;
    const apiKey = { id: 'api_key_1' } as ApiKey;
    const { resolver, apiKeyService } = createResolver({
      updateKey: vi.fn(async () => apiKey),
      deleteKey: vi.fn(async () => apiKey),
    });

    await expect(
      resolver.updateApiKey('api_key_1', { name: 'New' }, member),
    ).resolves.toBe(apiKey);
    await expect(resolver.deleteApiKey('api_key_1', member)).resolves.toBe(
      apiKey,
    );
    expect(apiKeyService.updateKey).toHaveBeenCalledWith('api_key_1', member, {
      name: 'New',
    });
    expect(apiKeyService.deleteKey).toHaveBeenCalledWith('api_key_1', member);
  });

  it('loads the API-key member field', async () => {
    const member = { id: 'member_1' } as WorkspaceMember;
    const apiKey = {
      member: { loadOrFail: vi.fn(async () => member) },
    } as unknown as ApiKey;
    const { resolver } = createResolver();

    await expect(resolver.member(apiKey)).resolves.toBe(member);
  });
});

function createResolver(overrides: Partial<ApiKeyService> = {}) {
  const apiKeyService = {
    createKey: vi.fn(),
    deleteKey: vi.fn(),
    getApiKey: vi.fn(),
    getListFilter: vi.fn(),
    updateKey: vi.fn(),
    ...overrides,
  } as unknown as Mocked<ApiKeyService>;
  const cm = { find: vi.fn() };

  return {
    resolver: new ApiKeyResolver(apiKeyService, cm as never),
    apiKeyService,
    cm,
  };
}
