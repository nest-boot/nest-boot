import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { UserPermission } from "../enums/index.js";
import { AuthEnumRegistry } from "./auth-enum-registry.js";

describe("auth enum registration", () => {
  const registrations: AuthEnumRegistry[] = [];
  const register = (options: AuthModuleOptions) => {
    const registry = new AuthEnumRegistry(options, [User]);
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
  it("rejects concurrent schemas with different owner features even when enums match", () => {
    register({});
    expect(() => new AuthEnumRegistry({}, [User, Member])).toThrow(
      "Concurrent AuthModule",
    );
  });
});
