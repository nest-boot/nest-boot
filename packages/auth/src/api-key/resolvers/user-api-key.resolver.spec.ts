import { ForbiddenException } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";
import type { Mocked } from "vitest";

import { User } from "../../core/entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { type UserApiKeyService } from "../services/user-api-key.service.js";
import { UserApiKeyResolver } from "./user-api-key.resolver.js";

describe("UserApiKeyResolver", () => {
  it("preserves parent scope, selection and access failures on credential relations", async () => {
    const user = new User();
    const key = { id: "key" };
    const result = { edges: [], pageInfo: {} };
    const args = { first: 10, after: "cursor" };
    const info = {
      fieldNodes: [],
      fragments: {},
      variableValues: {},
    } as unknown as GraphQLResolveInfo;
    const getUserApiKey = vi.fn().mockResolvedValue(key);
    const getUserApiKeyConnection = vi.fn().mockResolvedValue(result);
    const resolver = new UserApiKeyResolver({
      getUserApiKey,
      getUserApiKeyConnection,
    } as unknown as UserApiKeyService);
    await expect(resolver.apiKey(user, "key")).resolves.toBe(key);
    expect(getUserApiKey).toHaveBeenCalledExactlyOnceWith("key", user);
    getUserApiKey.mockResolvedValueOnce(null);
    await expect(resolver.apiKey(user, "hidden")).resolves.toBeNull();
    await expect(resolver.apiKeys(user, args, info)).resolves.toBe(result);
    expect(getUserApiKeyConnection).toHaveBeenCalledExactlyOnceWith(
      user,
      args,
      info,
    );
    getUserApiKeyConnection.mockRejectedValueOnce(new ForbiddenException());
    await expect(resolver.apiKeys(user, args, info)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("returns the service's permission choices for the current user", () => {
    const owner = { id: "user_1" } as User;
    const result = [
      { permission: "workspace:update", grantable: false, default: true },
    ];
    const { resolver, apiKeyService } = createResolver({
      getUserApiKeyPermissions: vi.fn(() => result),
    });
    expect(resolver.userApiKeyPermissions(owner)).toBe(result);
    expect(apiKeyService.getUserApiKeyPermissions).toHaveBeenCalledWith(owner);
  });

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

/**
 * Returns test resolver and its mocked dependencies.
 * @param overrides - Fixture values that replace the defaults.
 * @returns Test resolver and its mocked dependencies.
 */
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
