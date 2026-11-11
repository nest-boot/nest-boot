import { NotFoundException } from "@nestjs/common";
import { type Mocked } from "vitest";

import { User as BaseUser } from "../../core/entities/user.entity.js";
import { type UserService } from "../../core/services/user.service.js";
import { AdminUserResolver } from "./admin-user.resolver.js";

describe("AdminUserResolver", () => {
  it("returns only identifiers after administrative writes", async () => {
    const user = { id: "created-user", name: "Private profile" } as BaseUser;
    const service = {
      createUser: vi.fn().mockResolvedValue(user),
      updateUser: vi.fn().mockResolvedValue(user),
      setUserRoles: vi.fn().mockResolvedValue(user),
      setUserPermissions: vi.fn().mockResolvedValue(user),
      banUser: vi.fn().mockResolvedValue(user),
      unbanUser: vi.fn().mockResolvedValue(user),
    };
    const { resolver } = createResolver(service);
    const input = {
      email: "new@example.com",
      name: "New",
      password: "password",
    };
    for (const result of [
      resolver.createUser(input),
      resolver.updateUser(user.id, { name: "Updated" }),
      resolver.setUserRoles(user.id, { roles: ["user"] }),
      resolver.setUserPermissions(user.id, { permissions: [] }),
      resolver.banUser(user.id, { reason: "Test", expiresIn: 60 }),
      resolver.unbanUser(user.id),
    ]) {
      await expect(result).resolves.toEqual({ id: user.id });
    }
    expect(service.createUser).toHaveBeenCalledWith(input);
    expect(service.updateUser).toHaveBeenCalledWith(user.id, {
      name: "Updated",
    });
    expect(service.banUser).toHaveBeenCalledWith(user.id, {
      banReason: "Test",
      banExpiresIn: 60,
    });
    expect(service.unbanUser).toHaveBeenCalledWith(user.id);
  });

  it("delegates deletion to UserService.deleteUser", async () => {
    const user = { id: "user-1", name: "Deleted user" } as BaseUser;
    const { resolver, service } = createResolver({
      getUser: vi.fn(async () => user),
      deleteUser: vi.fn(async () => user),
    });
    await expect(resolver.deleteUser(user.id)).resolves.toEqual({
      id: user.id,
    });
    expect(service.getUser).not.toHaveBeenCalled();
    expect(service.deleteUser).toHaveBeenCalledWith(user.id);
  });

  it("propagates a missing-user error from the deletion service", async () => {
    const { resolver, service } = createResolver({
      getUser: vi.fn(async () => null),
      deleteUser: vi.fn().mockRejectedValue(new NotFoundException()),
    });
    await expect(resolver.deleteUser("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(service.deleteUser).toHaveBeenCalledWith("missing");
  });

  it("delegates user connection pagination", async () => {
    const connection = { nodes: [], edges: [], pageInfo: {} };
    const { resolver, service } = createResolver({
      getUserConnection: vi.fn().mockResolvedValue(connection),
    });
    const args = { first: 10, after: "cursor", query: "alice" };
    await expect(resolver.users(args)).resolves.toBe(connection);
    expect(service.getUserConnection).toHaveBeenCalledWith(args, undefined);
  });

  it("updates permissions through UserService", async () => {
    const user = { id: "user-1" } as BaseUser;
    const { resolver, service } = createResolver({
      getUser: vi.fn(async () => user),
      setUserPermissions: vi.fn(async () => user),
    });
    await expect(
      resolver.setUserPermissions(user.id, {
        permissions: ["user:read"],
      }),
    ).resolves.toEqual({ id: user.id });
    expect(service.setUserPermissions).toHaveBeenCalledWith(user.id, [
      "user:read",
    ]);
  });

  it("lists configured roles and updates a user role", async () => {
    const user = { id: "user-1" } as BaseUser;
    const roles = [{ role: "admin", grantable: false }];
    const permissions = [{ permission: "user:read", grantable: true }];
    const { resolver, service } = createResolver({
      getUser: vi.fn(async () => user),
      listPermissions: vi.fn(() => permissions),
      listRoles: vi.fn(() => roles),
      setUserRoles: vi.fn(async () => user),
    });
    expect(resolver.userRoles()).toEqual(roles);
    expect(resolver.userPermissions()).toEqual(permissions);
    await expect(
      resolver.setUserRoles(user.id, { roles: ["admin"] }),
    ).resolves.toEqual({ id: user.id });
    expect(service.setUserRoles).toHaveBeenCalledWith(user.id, ["admin"]);
  });
});
/**
 *
 * @param overrides - User service methods replaced for this test.
 * @returns Resolver and its mocked dependencies.
 */
function createResolver(overrides: Partial<UserService> = {}) {
  const service = overrides as Mocked<UserService>;
  return { service, resolver: new AdminUserResolver(service) };
}
