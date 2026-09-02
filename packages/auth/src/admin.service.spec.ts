/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import type { Mocked } from "vitest";

import { AdminService } from "./admin.service.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { BaseAccount, BaseSession, BaseUser } from "./entities/index.js";

class TestAccount extends BaseAccount {}
class TestSession extends BaseSession {}
class TestUser extends BaseUser {}

describe("AdminService", () => {
  it("creates a user and credential account with the configured hasher", async () => {
    const { em, hash, service } = createService();
    hash.mockResolvedValue("hashed-password");

    const user = await service.createUser({
      data: { locale: "en" },
      email: "alice@example.com",
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

  it("gets and updates configured user entities", async () => {
    const { em, service } = createService();
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

    await service.unbanUser(user);
    expect(user.banned).toBe(false);
    expect(user.banReason).toBeNull();
    expect(user.banExpiresAt).toBeNull();
    vi.useRealTimers();
  });

  it("creates and restores impersonation sessions", async () => {
    const { em, service } = createService();
    const administrator = Object.assign(new TestUser(), { id: "admin-1" });
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

function createService(useCustomHash = true) {
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
    entities: {
      account: TestAccount,
      session: TestSession,
      user: TestUser,
    },
    session: { expiresIn: 3600 },
  } as unknown as AuthModuleOptions;

  return {
    em,
    hash,
    hashServiceHash,
    service: new AdminService<TestUser, TestAccount, TestSession>(
      em,
      options,
      hashService,
    ),
  };
}
