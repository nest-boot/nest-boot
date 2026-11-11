import { AuthEnumRegistry } from "./auth-enum-registry.js";
import { UserPermission } from "./enums/user-permission.enum.js";
import type { AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";

describe("auth enum registration", () => {
  const registrations: AuthEnumRegistry[] = [];
  const register = (options: AuthModuleOptions) => {
    const registry = new AuthEnumRegistry(options);
    registrations.push(registry);
    return registry;
  };
  afterEach(() => {
    registrations.splice(0).forEach((registry) => {
      registry.onModuleDestroy();
    });
  });
  it("rejects mapping collisions before changing registered metadata", () => {
    register({});
    expect(() =>
      register({
        user: { permissions: ["user-api-key:read", "user_api_key:read"] },
      }),
    ).toThrow("Permission enum collision");
    expect(UserPermission.USER__READ).toBe("user:read");
  });
  it("rejects concurrent schemas with different optional features even when enums match", () => {
    register({});
    expect(
      () => new AuthEnumRegistry({ workspace: { enabled: true } }),
    ).toThrow("Concurrent AuthModule");
  });
});
