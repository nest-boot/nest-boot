/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { Mocked } from "vitest";

import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type { AuthorizationService } from "./authorization.service.js";
import {
  BaseAccount,
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
import { UserService } from "./user.service.js";

class TestAccount extends BaseAccount {}
class TestApiKey extends BaseApiKey {}
class TestSession extends BaseSession {}
class TestUser extends BaseUser {}
class TestWorkspaceInvitation extends BaseWorkspaceInvitation {}
class TestWorkspaceMember extends BaseWorkspaceMember {}

describe("UserService", () => {
  it("fails before persistence when a service-level permission is denied", async () => {
    const { authorizationService, em, service } = createService();
    vi.mocked(authorizationService.assertUserCan).mockImplementation(() => {
      throw new ForbiddenException();
    });

    await expect(service.listUsers()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(em.findAndCount).not.toHaveBeenCalled();
  });

  it("creates a user and credential account with the configured hasher", async () => {
    const { em, hash, service } = createService();
    hash.mockResolvedValue("hashed-password");

    const user = await service.createUser({
      data: { locale: "en" },
      email: " Alice@Example.com ",
      name: "Alice",
      password: "password",
      permissions: ["user:list"],
    });

    expect(hash).toHaveBeenCalledWith("password");
    expect(em.create).toHaveBeenNthCalledWith(
      1,
      TestUser,
      expect.objectContaining({
        email: "alice@example.com",
        emailVerified: false,
        locale: "en",
        name: "Alice",
        permissions: ["user:list"],
      }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      2,
      TestAccount,
      expect.objectContaining({
        issuer: "local:credential",
        password: "hashed-password",
        providerId: "credential",
      }),
    );
    expect(em.persist).toHaveBeenCalledTimes(2);
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(user.email).toBe("alice@example.com");
  });

  it("uses the configured default user role", async () => {
    const { em, hash, service } = createService(true, {
      defaultRole: "customer",
      permissions: [],
      roles: { customer: [] },
    });
    hash.mockResolvedValue("hashed-password");

    await service.createUser({
      email: "alice@example.com",
      name: "Alice",
      password: "password",
    });

    expect(em.create).toHaveBeenNthCalledWith(
      1,
      TestUser,
      expect.objectContaining({ roles: ["customer"] }),
    );
    expect(
      service.getUserPermissions(
        Object.assign(new TestUser(), { roles: undefined }),
      ),
    ).toEqual([]);
  });

  it("gets and updates configured user entities", async () => {
    const { authorizationService, em, service } = createService();
    const user = Object.assign(new TestUser(), { id: "user-1" });
    em.findOne.mockResolvedValue(user);

    await expect(service.getUser("user-1")).resolves.toBe(user);
    await expect(service.updateUser(user, { name: "Renamed" })).resolves.toBe(
      user,
    );
    await expect(service.setUserPermissions(user, ["user:get"])).resolves.toBe(
      user,
    );

    expect(em.findOne).toHaveBeenCalledWith(
      TestUser,
      { id: "user-1" },
      { filters: false },
    );
    expect(em.assign).toHaveBeenCalledWith(user, { name: "Renamed" });
    expect(user.permissions).toEqual(["user:get"]);
    expect(authorizationService.assertUserCan).toHaveBeenCalledWith(
      "get",
      TestUser,
    );
    expect(authorizationService.assertUserCan).toHaveBeenCalledWith(
      "update",
      user,
    );
    await expect(
      service.updateUser(user, { roles: ["admin"] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("normalizes email addresses when updating a user", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), { email: "old@example.com" });

    await service.updateUser(user, { email: " New@Example.com " });

    expect(em.assign).toHaveBeenCalledWith(user, {
      email: "new@example.com",
    });
    expect(user.email).toBe("new@example.com");
  });

  it("validates direct user permissions against the configured catalog", async () => {
    const { em, hash, service } = createService();
    hash.mockResolvedValue("hashed-password");

    await expect(
      service.createUser({
        email: "invalid@example.com",
        name: "Invalid",
        password: "password",
        permissions: ["workspace:update"],
      }),
    ).rejects.toThrow("User contains unknown permissions: workspace:update");
    expect(em.create).not.toHaveBeenCalled();

    const user = new TestUser();
    await expect(
      service.setUserPermissions(user, ["user:get", "user:get"]),
    ).rejects.toThrow("User contains duplicate permissions: user:get");
    await expect(service.setUserPermissions(user, ["user:get"])).resolves.toBe(
      user,
    );
    expect(user.permissions).toEqual(["user:get"]);
  });

  it("gets a configured user by normalized email", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), {
      email: "alice@example.com",
      id: "user-1",
    });
    em.findOne.mockResolvedValue(user);

    await expect(service.getUserByEmail(" Alice@Example.com ")).resolves.toBe(
      user,
    );
    expect(em.findOne).toHaveBeenCalledWith(
      TestUser,
      { email: "alice@example.com" },
      { filters: false },
    );
  });

  it("lists configured roles and assigns only known roles", async () => {
    const { service } = createService(true, {
      permissions: ["user:create", "user:set-role", "user:list", "user:delete"],
      roles: {
        admin: ["user:create", "user:set-role"],
        auditor: ["user:list"],
        user: [],
      },
    });
    const user = Object.assign(new TestUser(), {
      permissions: ["session:list"],
      roles: ["user"],
    });

    expect(service.listRoles()).toEqual([
      {
        name: "admin",
        permissions: ["user:create", "user:set-role"],
      },
      { name: "auditor", permissions: ["user:list"] },
      { name: "user", permissions: [] },
    ]);
    expect(service.listPermissions()).toEqual([
      "user:create",
      "user:set-role",
      "user:list",
      "user:delete",
    ]);

    await expect(service.setRole(user, ["auditor", "user"])).resolves.toBe(
      user,
    );
    expect(user.roles).toEqual(["auditor", "user"]);
    expect(service.getUserPermissions(user)).toEqual([
      "user:list",
      "session:list",
    ]);
    await expect(service.setRole(user, ["unknown"])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("classifies users with any configured admin role as administrators", () => {
    const { service } = createService(true, {
      adminRoles: ["admin", "superadmin"],
      permissions: [],
      roles: { admin: [], superadmin: [], user: [] },
    });

    expect(
      service.isAdmin(Object.assign(new TestUser(), { roles: ["auditor"] })),
    ).toBe(false);
    expect(
      service.isAdmin(
        Object.assign(new TestUser(), { roles: ["auditor", "superadmin"] }),
      ),
    ).toBe(true);
  });

  it("lists users with search, filter, order, and pagination", async () => {
    const { em, service } = createService();
    const users = [new TestUser()];
    em.findAndCount.mockResolvedValue([users, 7]);

    await expect(
      service.listUsers({
        filterField: "emailVerified",
        filterValue: true,
        limit: 10,
        offset: 20,
        searchField: "name",
        searchOperator: "starts_with",
        searchValue: "Ali",
        sortBy: "name",
        sortDirection: "desc",
      }),
    ).resolves.toEqual({ limit: 10, offset: 20, total: 7, users });
    expect(em.findAndCount).toHaveBeenCalledWith(
      TestUser,
      { emailVerified: true, name: { $like: "Ali%" } },
      expect.objectContaining({
        filters: false,
        limit: 10,
        offset: 20,
        orderBy: { name: "desc" },
      }),
    );
  });

  it("lists and revokes user sessions", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const session = Object.assign(new TestSession(), {
      token: "session-token",
      userId: "user-1",
    });
    em.find.mockResolvedValue([session]);
    em.findOne.mockResolvedValue(session);
    em.nativeDelete.mockResolvedValue(2);

    await expect(service.listUserSessions(user)).resolves.toEqual([session]);
    await expect(
      service.revokeUserSession(user, "session-token"),
    ).resolves.toBe(true);
    await expect(service.revokeUserSessions(user)).resolves.toBe(2);

    expect(em.find).toHaveBeenCalledWith(
      TestSession,
      expect.objectContaining({ userId: "user-1" }),
      { filters: false, orderBy: { createdAt: "desc" } },
    );
    expect(em.remove).toHaveBeenCalledWith(session);
    expect(em.nativeDelete).toHaveBeenCalledWith(TestSession, {
      userId: "user-1",
    });
  });

  it("bans, revokes sessions, and unbans a user", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00Z"));
    const { em, service } = createService();
    const user = new TestUser();
    em.nativeDelete.mockResolvedValue(1);

    await service.banUser(user, {
      banExpiresIn: 3600,
      banReason: "abuse",
    });
    expect(user.banned).toBe(true);
    expect(user.banReason).toBe("abuse");
    expect(user.banExpiresAt).toEqual(new Date("2026-09-02T01:00:00Z"));
    expect(em.nativeDelete).toHaveBeenCalledTimes(1);
    expect(em.nativeDelete).toHaveBeenCalledWith(TestSession, {
      $or: [{ userId: user.id }, { impersonatedBy: user }],
    });

    await service.unbanUser(user);
    expect(user.banned).toBe(false);
    expect(user.banReason).toBeNull();
    expect(user.banExpiresAt).toBeNull();
    vi.useRealTimers();
  });

  it("creates and restores impersonation sessions", async () => {
    const { em, service } = createService();
    const administrator = Object.assign(new TestUser(), {
      id: "admin-1",
      roles: ["admin"],
    });
    const user = Object.assign(new TestUser(), { id: "user-1" });

    const impersonation = await service.impersonateUser(administrator, user, {
      ipAddress: "127.0.0.1",
    });
    expect(impersonation.user).toBe(user);
    expect(impersonation.session.impersonatedBy).toBe(administrator);
    expect(impersonation.session.userId).toBe("user-1");

    em.findOne.mockResolvedValue(administrator);
    const restored = await service.stopImpersonating(impersonation.session);
    expect(restored?.user).toBe(administrator);
    expect(restored?.session.userId).toBe("admin-1");
    expect(em.remove).toHaveBeenCalledWith(impersonation.session);
  });

  it("requires the additional permission when impersonating an administrator", async () => {
    const { service } = createService();
    const target = Object.assign(new TestUser(), { roles: ["admin"] });
    const ordinaryImpersonator = Object.assign(new TestUser(), {
      permissions: ["user:impersonate"],
      roles: ["user"],
    });
    const privilegedImpersonator = Object.assign(new TestUser(), {
      permissions: ["user:impersonate", "user:impersonate-admins"],
      roles: ["user"],
    });

    await expect(
      service.impersonateUser(ordinaryImpersonator, target),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.impersonateUser(privilegedImpersonator, target),
    ).resolves.toEqual(expect.objectContaining({ user: target }));
  });

  it("revokes an impersonation session instead of restoring a banned administrator", async () => {
    const { em, service } = createService();
    const administrator = Object.assign(new TestUser(), {
      banned: true,
      banExpiresAt: null,
      id: "admin-1",
    });
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const impersonation = await service.impersonateUser(
      Object.assign(new TestUser(), { id: "issuer-1", roles: ["admin"] }),
      user,
    );
    impersonation.session.impersonatedBy = administrator;
    em.findOne.mockResolvedValue(administrator);

    await expect(
      service.stopImpersonating(impersonation.session),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.remove).toHaveBeenCalledWith(impersonation.session);
    expect(em.flush).toHaveBeenCalled();
  });

  it("removes dependent records before deleting a user", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), { id: "user-1" });

    await expect(service.removeUser(user)).resolves.toBe(user);

    expect(em.nativeDelete).toHaveBeenNthCalledWith(1, TestSession, {
      $or: [{ userId: "user-1" }, { impersonatedBy: user }],
    });
    expect(em.nativeDelete).toHaveBeenNthCalledWith(2, TestAccount, {
      userId: "user-1",
    });
    expect(em.nativeDelete).toHaveBeenNthCalledWith(3, TestApiKey, {
      owner: user,
    });
    expect(em.nativeDelete).toHaveBeenNthCalledWith(
      4,
      TestWorkspaceInvitation,
      { inviter: user },
    );
    expect(em.nativeDelete).toHaveBeenNthCalledWith(5, TestWorkspaceMember, {
      user,
    });
    expect(em.remove).toHaveBeenCalledWith(user);
    expect(em.flush).toHaveBeenCalled();
  });

  it("sets an existing credential password or creates the account", async () => {
    const { em, hash, service } = createService();
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const account = Object.assign(new TestAccount(), {
      password: "old-hash",
    });
    hash.mockResolvedValueOnce("new-hash").mockResolvedValueOnce("first-hash");
    em.findOne.mockResolvedValueOnce(account).mockResolvedValueOnce(null);

    await service.setUserPassword(user, "new-password");
    expect(account.password).toBe("new-hash");

    await service.setUserPassword(user, "first-password");
    expect(em.create).toHaveBeenLastCalledWith(
      TestAccount,
      expect.objectContaining({
        issuer: "local:credential",
        password: "first-hash",
        providerId: "credential",
        userId: "user-1",
      }),
    );
  });

  it("uses HashService when no Better Auth password override is configured", async () => {
    const { hashServiceHash, service } = createService(false);
    hashServiceHash.mockResolvedValue("hash-service-password");

    await service.createUser({
      email: "alice@example.com",
      name: "Alice",
      password: "password",
    });

    expect(hashServiceHash).toHaveBeenCalledWith("password");
  });

  it("checks flattened permissions without an admin plugin", () => {
    const { service } = createService();
    const user = Object.assign(new TestUser(), {
      permissions: ["user:list", "session:revoke"],
    });

    expect(
      service.hasPermission(user, {
        permissions: { session: ["revoke"], user: ["list"] },
      }),
    ).toBe(true);
    expect(
      service.hasPermission(user, {
        permissions: { user: ["delete"] },
      }),
    ).toBe(false);
  });
});

function createService(
  useCustomHash = true,
  user: NonNullable<AuthModuleOptions["user"]> = {},
) {
  const em = {
    assign: vi.fn((entity, input) => Object.assign(entity, input)),
    create: vi.fn((Entity, input) => Object.assign(new Entity(), input)),
    find: vi.fn(),
    findAndCount: vi.fn(),
    findOne: vi.fn(),
    flush: vi.fn(),
    nativeDelete: vi.fn(),
    persist: vi.fn(),
    remove: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);
  em.remove.mockReturnValue(em);
  const hash = vi.fn();
  const hashServiceHash = vi.fn();
  const hashService = {
    hash: hashServiceHash,
  } as unknown as HashService;
  const options = {
    ...(useCustomHash
      ? { emailAndPassword: { password: { hash } } }
      : { emailAndPassword: {} }),
    user,
    entities: {
      account: TestAccount,
      apiKey: TestApiKey,
      session: TestSession,
      user: TestUser,
      workspaceInvitation: TestWorkspaceInvitation,
      workspaceMember: TestWorkspaceMember,
    },
    session: { expiresIn: 3600 },
  } as unknown as AuthModuleOptions;
  const authorizationService = {
    assertCurrentSession: vi.fn(),
    assertCurrentUser: vi.fn(),
    assertUserCan: vi.fn(),
  } as unknown as AuthorizationService;
  return {
    authorizationService,
    em,
    hash,
    hashServiceHash,
    service: new UserService<TestUser, TestAccount, TestSession>(
      em,
      options,
      hashService,
      authorizationService,
    ),
  };
}
