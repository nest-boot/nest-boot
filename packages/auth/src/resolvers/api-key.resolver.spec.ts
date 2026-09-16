import type { Mocked } from "vitest";

import { ApiKey } from "../entities/api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { type ApiKeyService } from "../services/api-key.service.js";
import { ApiKeyResolver } from "./api-key.resolver.js";

describe("ApiKeyResolver", () => {
  it("delegates API-key creation to the auth service", async () => {
    const workspace = { id: "workspace_1" } as Workspace;
    const result = {
      entity: { id: "api_key_1" } as ApiKey,
      apiKey: "sk-0123456789abcdefabcdef0123456789",
    };
    const { resolver, apiKeyService } = createResolver({
      createWorkspaceApiKey: vi.fn(async () => result),
    });

    await expect(
      resolver.createWorkspaceApiKey(
        {
          name: "Deploy key",
          permissions: ["workspace:update"],
        },
        workspace,
      ),
    ).resolves.toBe(result);
    expect(apiKeyService.createWorkspaceApiKey).toHaveBeenCalledWith(
      workspace,
      {
        name: "Deploy key",
        expiresAt: null,
        permissions: ["workspace:update"],
      },
    );
  });

  it("delegates API-key updates and deletion to the auth service", async () => {
    const apiKey = { id: "api_key_1" } as ApiKey;
    const { resolver, apiKeyService } = createResolver({
      updateWorkspaceApiKey: vi.fn(async () => apiKey),
      deleteWorkspaceApiKey: vi.fn(async () => apiKey),
    });

    await expect(
      resolver.updateWorkspaceApiKey("api_key_1", {
        enabled: false,
        name: "New",
        permissions: ["workspace:update"],
      }),
    ).resolves.toBe(apiKey);
    await expect(resolver.deleteWorkspaceApiKey("api_key_1")).resolves.toBe(
      apiKey,
    );
    expect(apiKeyService.updateWorkspaceApiKey).toHaveBeenCalledWith(
      "api_key_1",
      {
        enabled: false,
        name: "New",
        permissions: ["workspace:update"],
      },
    );
    expect(apiKeyService.deleteWorkspaceApiKey).toHaveBeenCalledWith(
      "api_key_1",
    );
  });
});

function createResolver(overrides: Partial<ApiKeyService> = {}) {
  const apiKeyService = {
    createWorkspaceApiKey: vi.fn(),
    deleteWorkspaceApiKey: vi.fn(),
    updateWorkspaceApiKey: vi.fn(),
    ...overrides,
  } as unknown as Mocked<ApiKeyService>;

  return {
    resolver: new ApiKeyResolver(apiKeyService),
    apiKeyService,
  };
}
