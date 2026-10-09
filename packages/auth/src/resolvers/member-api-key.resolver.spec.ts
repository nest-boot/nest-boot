import type { Mocked } from "vitest";

import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { type MemberApiKeyService } from "../services/member-api-key.service.js";
import { MemberApiKeyResolver } from "./member-api-key.resolver.js";

describe("MemberApiKeyResolver", () => {
  it("returns the service's permission choices for the current workspace", () => {
    const owner = { id: "workspace_1" } as Workspace;
    const result = [
      { permission: "workspace:update", grantable: false, default: true },
    ];
    const { resolver, apiKeyService } = createResolver({
      getMemberApiKeyPermissions: vi.fn(() => result),
    });
    expect(resolver.memberApiKeyPermissions(owner)).toBe(result);
    expect(apiKeyService.getMemberApiKeyPermissions).toHaveBeenCalledWith(
      owner,
    );
  });

  it.each([undefined, "member_1"])(
    "maps optional memberId %s to the domain owner",
    async (memberId) => {
      const workspace = { id: "workspace_1" } as Workspace;
      const result = {
        entity: { id: "api_key_1" } as MemberApiKey,
        apiKey: "sk-0123456789abcdefabcdef0123456789",
      };
      const { resolver, apiKeyService } = createResolver({
        createMemberApiKey: vi.fn(async () => result),
      });

      await expect(
        resolver.createMemberApiKey(
          {
            name: "Deploy key",
            memberId,
            permissions: ["workspace:update"],
          },
          workspace,
        ),
      ).resolves.toBe(result);
      expect(apiKeyService.createMemberApiKey).toHaveBeenCalledWith(workspace, {
        name: "Deploy key",
        ...(memberId ? { member: memberId } : {}),
        permissions: ["workspace:update"],
      });
    },
  );

  it("delegates API-key updates and deletion to the auth service", async () => {
    const apiKey = { id: "api_key_1" } as MemberApiKey;
    const { resolver, apiKeyService } = createResolver({
      updateMemberApiKey: vi.fn(async () => apiKey),
      deleteMemberApiKey: vi.fn(async () => apiKey),
    });

    await expect(
      resolver.updateMemberApiKey("api_key_1", {
        enabled: false,
        name: "New",
        permissions: ["workspace:update"],
      }),
    ).resolves.toBe(apiKey);
    await expect(resolver.deleteMemberApiKey("api_key_1")).resolves.toBe(
      apiKey,
    );
    expect(apiKeyService.updateMemberApiKey).toHaveBeenCalledWith("api_key_1", {
      enabled: false,
      name: "New",
      permissions: ["workspace:update"],
    });
    expect(apiKeyService.deleteMemberApiKey).toHaveBeenCalledWith("api_key_1");
  });
});

function createResolver(overrides: Partial<MemberApiKeyService> = {}) {
  const apiKeyService = {
    createMemberApiKey: vi.fn(),
    deleteMemberApiKey: vi.fn(),
    updateMemberApiKey: vi.fn(),
    ...overrides,
  } as unknown as Mocked<MemberApiKeyService>;

  return {
    resolver: new MemberApiKeyResolver(apiKeyService),
    apiKeyService,
  };
}
