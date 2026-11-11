import type { Mocked } from "vitest";

import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { type WorkspaceApiKeyService } from "../services/workspace-api-key.service.js";
import { WorkspaceApiKeyResolver } from "./workspace-api-key.resolver.js";

describe("WorkspaceApiKeyResolver", () => {
  it("returns the service's permission choices for the current workspace", () => {
    const owner = { id: "workspace_1" } as Workspace;
    const result = [
      { permission: "workspace:update", grantable: false, default: true },
    ];
    const { resolver, apiKeyService } = createResolver({
      getWorkspaceApiKeyPermissions: vi.fn(() => result),
    });
    expect(resolver.workspaceApiKeyPermissions(owner)).toBe(result);
    expect(apiKeyService.getWorkspaceApiKeyPermissions).toHaveBeenCalledWith(
      owner,
    );
  });

  it.each([undefined, "member_1"])(
    "maps optional memberId %s to the domain owner",
    async (memberId) => {
      const workspace = { id: "workspace_1" } as Workspace;
      const result = {
        entity: { id: "api_key_1" } as WorkspaceApiKey,
        apiKey: "sk-0123456789abcdefabcdef0123456789",
      };
      const { resolver, apiKeyService } = createResolver({
        createWorkspaceApiKey: vi.fn(async () => result),
      });

      await expect(
        resolver.createWorkspaceApiKey(
          {
            name: "Deploy key",
            memberId,
            permissions: ["workspace:update"],
          },
          workspace,
        ),
      ).resolves.toBe(result);
      expect(apiKeyService.createWorkspaceApiKey).toHaveBeenCalledWith(
        workspace,
        {
          name: "Deploy key",
          ...(memberId ? { member: memberId } : {}),
          permissions: ["workspace:update"],
        },
      );
    },
  );

  it("delegates API-key updates and deletion to the auth service", async () => {
    const apiKey = { id: "api_key_1" } as WorkspaceApiKey;
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

/**
 * Returns test resolver and its mocked dependencies.
 * @param overrides - Fixture values that replace the defaults.
 * @returns Test resolver and its mocked dependencies.
 */
function createResolver(overrides: Partial<WorkspaceApiKeyService> = {}) {
  const apiKeyService = {
    createWorkspaceApiKey: vi.fn(),
    deleteWorkspaceApiKey: vi.fn(),
    updateWorkspaceApiKey: vi.fn(),
    ...overrides,
  } as unknown as Mocked<WorkspaceApiKeyService>;

  return {
    resolver: new WorkspaceApiKeyResolver(apiKeyService),
    apiKeyService,
  };
}
