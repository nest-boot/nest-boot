import type { Mocked } from "vitest";

import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { type UserApiKeyService } from "../services/user-api-key.service.js";
import { UserApiKeyResolver } from "./user-api-key.resolver.js";

describe("UserApiKeyResolver", () => {
  it("delegates API-key creation to the auth service", async () => {
    const user = { id: "user_1" } as User;
    const result = {
      entity: { id: "api_key_1" } as UserApiKey,
      apiKey: "sk-0123456789abcdefabcdef0123456789",
    };
    const { resolver, apiKeyService } = createResolver({
      createUserApiKey: vi.fn(async () => result),
    });

    await expect(
      resolver.createUserApiKey(
        {
          name: "Deploy key",
          permissions: ["user:update"],
        },
        user,
      ),
    ).resolves.toBe(result);
    expect(apiKeyService.createUserApiKey).toHaveBeenCalledWith(user, {
      name: "Deploy key",
      permissions: ["user:update"],
    });
  });

  it("delegates API-key updates and deletion to the auth service", async () => {
    const apiKey = { id: "api_key_1" } as UserApiKey;
    const { resolver, apiKeyService } = createResolver({
      updateUserApiKey: vi.fn(async () => apiKey),
      deleteUserApiKey: vi.fn(async () => apiKey),
    });

    await expect(
      resolver.updateUserApiKey("api_key_1", {
        enabled: false,
        name: "New",
        permissions: ["user:update"],
      }),
    ).resolves.toBe(apiKey);
    await expect(resolver.deleteUserApiKey("api_key_1")).resolves.toBe(apiKey);
    expect(apiKeyService.updateUserApiKey).toHaveBeenCalledWith("api_key_1", {
      enabled: false,
      name: "New",
      permissions: ["user:update"],
    });
    expect(apiKeyService.deleteUserApiKey).toHaveBeenCalledWith("api_key_1");
  });
});

function createResolver(overrides: Partial<UserApiKeyService> = {}) {
  const apiKeyService = {
    createUserApiKey: vi.fn(),
    deleteUserApiKey: vi.fn(),
    updateUserApiKey: vi.fn(),
    ...overrides,
  } as unknown as Mocked<UserApiKeyService>;

  return {
    resolver: new UserApiKeyResolver(apiKeyService),
    apiKeyService,
  };
}
