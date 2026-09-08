import type { ApiKeyService } from '@nest-boot/auth';
import type { Mocked } from 'vitest';

vi.mock('@nest-boot/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nest-boot/auth')>()),
  ApiKeyService: class ApiKeyService {},
  BaseUser: class BaseUser {},
  CurrentUser: () => () => undefined,
  CurrentWorkspace: () => () => undefined,
  UserCan: () => () => undefined,
  WorkspaceCan: () => () => undefined,
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
import { ApiKey } from './api-key.entity.js';
import { ApiKeyResolver } from './api-key.resolver.js';

describe('ApiKeyResolver', () => {
  it('delegates single-key access checks to the auth service', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const apiKey = { id: 'api_key_1' } as ApiKey;
    const { resolver, apiKeyService } = createResolver({
      getWorkspaceApiKey: vi.fn(async () => apiKey),
    });

    await expect(resolver.apiKey('api_key_1', workspace)).resolves.toBe(apiKey);
    expect(apiKeyService.getWorkspaceApiKey).toHaveBeenCalledWith(
      'api_key_1',
      workspace,
    );
  });

  it('uses the auth service list filter for connection pagination', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const where = { owner: workspace };
    const args = { first: 10 } as never;
    const { resolver, apiKeyService, cm } = createResolver({
      getWorkspaceListFilter: vi.fn(() => where),
    });

    await resolver.apiKeys(args, workspace);

    expect(apiKeyService.getWorkspaceListFilter).toHaveBeenCalledWith(
      workspace,
    );
    expect(cm.find).toHaveBeenCalledWith(expect.any(Function), args, { where });
  });

  it('delegates API-key creation to the auth service', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const result = {
      entity: { id: 'api_key_1' } as ApiKey,
      apiKey: 'sk-0123456789abcdefabcdef0123456789',
    };
    const { resolver, apiKeyService } = createResolver({
      createWorkspaceKey: vi.fn(async () => result),
    });

    await expect(
      resolver.createApiKey(
        {
          name: 'Deploy key',
          permissions: ['Workspace:update'],
        },
        workspace,
      ),
    ).resolves.toBe(result);
    expect(apiKeyService.createWorkspaceKey).toHaveBeenCalledWith(workspace, {
      name: 'Deploy key',
      expiresAt: null,
      permissions: ['Workspace:update'],
    });
  });

  it('delegates API-key updates and deletion to the auth service', async () => {
    const workspace = { id: 'workspace_1' } as Workspace;
    const apiKey = { id: 'api_key_1' } as ApiKey;
    const { resolver, apiKeyService } = createResolver({
      updateWorkspaceKey: vi.fn(async () => apiKey),
      deleteWorkspaceKey: vi.fn(async () => apiKey),
    });

    await expect(
      resolver.updateApiKey(
        'api_key_1',
        {
          enabled: false,
          name: 'New',
          permissions: ['Workspace:update'],
        },
        workspace,
      ),
    ).resolves.toBe(apiKey);
    await expect(resolver.deleteApiKey('api_key_1', workspace)).resolves.toBe(
      apiKey,
    );
    expect(apiKeyService.updateWorkspaceKey).toHaveBeenCalledWith(
      'api_key_1',
      workspace,
      {
        enabled: false,
        name: 'New',
        permissions: ['Workspace:update'],
      },
    );
    expect(apiKeyService.deleteWorkspaceKey).toHaveBeenCalledWith(
      'api_key_1',
      workspace,
    );
  });
});

function createResolver(overrides: Partial<ApiKeyService> = {}) {
  const apiKeyService = {
    createWorkspaceKey: vi.fn(),
    deleteWorkspaceKey: vi.fn(),
    getWorkspaceApiKey: vi.fn(),
    getWorkspaceListFilter: vi.fn(),
    runUnrestricted: vi.fn((callback) => callback()),
    updateWorkspaceKey: vi.fn(),
    ...overrides,
  } as unknown as Mocked<ApiKeyService>;
  const cm = { find: vi.fn() };

  return {
    resolver: new ApiKeyResolver(apiKeyService, cm as never),
    apiKeyService,
    cm,
  };
}
