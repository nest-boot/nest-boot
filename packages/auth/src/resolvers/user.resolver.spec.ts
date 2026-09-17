import { NotFoundException } from "@nestjs/common";
import type { Mocked } from "vitest";

import { type User as BaseUser } from "../entities/user.entity.js";
import { type AccountService } from "../services/account.service.js";
import { type InvitationService } from "../services/invitation.service.js";
import { type SessionService } from "../services/session.service.js";
import { type UserService } from "../services/user.service.js";
import { type WorkspaceService } from "../services/workspace.service.js";
import { UserResolver } from "./user.resolver.js";

describe("UserResolver", () => {
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
  it("delegates account pagination and authorization to AccountService", async () => {
    const user = { id: "self" } as BaseUser;
    const args = { first: 10, after: "cursor" };
    const result = { edges: [], pageInfo: {} };
    const getAccountConnectionByUser = vi.fn().mockResolvedValue(result);
    const resolver = new UserResolver(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { getAccountConnectionByUser } as unknown as AccountService,
    );
    await expect(resolver.accounts(user, args)).resolves.toBe(result);
    expect(getAccountConnectionByUser).toHaveBeenCalledWith(user, args);
    const denied = new Error("Account access denied");
    getAccountConnectionByUser.mockRejectedValueOnce(denied);
    await expect(resolver.accounts(user, args)).rejects.toBe(denied);
  });
  it("resolves the parent user's sessions through the authorized service", async () => {
    const user = { id: "parent-user" } as BaseUser;
    const sessions = [{ id: "session-1", customField: "application-owned" }];
    const getSessionConnectionByUser = vi.fn().mockResolvedValue(sessions);
    const { resolver } = createResolver({}, { getSessionConnectionByUser });
    await expect(resolver.sessions(user, { first: 10 })).resolves.toBe(
      sessions,
    );
    expect(getSessionConnectionByUser).toHaveBeenCalledWith(user, {
      first: 10,
    });
    const denied = new Error("session access denied");
    getSessionConnectionByUser.mockRejectedValueOnce(denied);
    await expect(resolver.sessions(user, { first: 10 })).rejects.toBe(denied);
  });
  it("passes the parent user and connection arguments to the workspace service", async () => {
    const user = { id: "parent-user" } as BaseUser;
    const args = { first: 10, after: "cursor" };
    const connection = { edges: [], pageInfo: {} };
    const getInvitationConnectionByUser = vi.fn().mockResolvedValue(connection);
    const resolver = new UserResolver(
      {} as UserService,
      {} as WorkspaceService,
      {} as never,
      {} as never,
      {
        getInvitationConnectionByUser,
      } as unknown as InvitationService,
      {} as never,
    );
    await expect(resolver.invitations(user, args)).resolves.toBe(connection);
    expect(getInvitationConnectionByUser).toHaveBeenCalledWith(user, args);
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
    expect(service.getUserConnection).toHaveBeenCalledWith(args);
  });

  it("updates permissions through UserService", async () => {
    const user = { id: "user-1" } as BaseUser;
    const { resolver, service } = createResolver({
      getUser: vi.fn(async () => user),
      setUserPermissions: vi.fn(async () => user),
    });

    await expect(
      resolver.setUserPermissions(user.id, {
        permissions: ["user:list"],
      }),
    ).resolves.toEqual({ id: user.id });
    expect(service.setUserPermissions).toHaveBeenCalledWith(user.id, [
      "user:list",
    ]);
  });

  it("lists configured roles and updates a user role", async () => {
    const user = { id: "user-1" } as BaseUser;
    const roles = [{ role: "admin", grantable: false }];
    const permissions = [{ permission: "user:list", grantable: true }];
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

function createResolver(
  overrides: Partial<UserService> = {},
  sessionOverrides: Partial<SessionService> = {},
) {
  const service = { ...overrides } as unknown as Mocked<UserService>;
  return {
    service,
    resolver: new UserResolver(
      service,
      {} as WorkspaceService,
      {} as never,
      sessionOverrides as SessionService,
      {} as never,
      {} as never,
    ),
  };
}
