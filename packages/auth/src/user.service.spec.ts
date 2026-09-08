/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import type { Mocked } from "vitest";

import type { AccessControlService } from "./access-control.service.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import {
  BaseAccount,
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
import { UserService } from "./user.service.js";
import {
  UserDeletionService,
  WorkspaceOwnershipConflictError,
} from "./user-deletion.service.js";

class TestAccount extends BaseAccount {}
class TestApiKey extends BaseApiKey {}
class TestSession extends BaseSession {}
class TestUser extends BaseUser {}
class TestWorkspaceInvitation extends BaseWorkspaceInvitation {}
class TestWorkspaceMember extends BaseWorkspaceMember {}

describe("UserService", () => {
  it("fails before persistence when a service-level permission is denied", async () => {
    const { accessControlService, em, service } = createService();
    vi.mocked(accessControlService.assertUserCan).mockImplementation(() => {
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
      permissions: ["User:list"],
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
        permissions: ["User:list"],
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
    expect(em.flush).toHaveBeenCalledTimes(2);
    expect(user.email).toBe("alice@example.com");
  });

  it("flushes a database-generated user id before creating the credential account", async () => {
    const { em, hash, service } = createService();
    hash.mockResolvedValue("hashed-password");
    em.create.mockImplementation((Entity, input) => {
      const entity = Object.assign(new Entity(), input);
      if (Entity === TestUser) Reflect.deleteProperty(entity, "id");
      return entity;
    });
    em.flush.mockImplementationOnce(() => {
      const user = em.create.mock.results[0]?.value as TestUser;
      user.id = "generated-user-id";
      return Promise.resolve();
    });

    await service.createUser({
      email: "alice@example.com",
      name: "Alice",
      password: "password",
    });

    expect(em.create).toHaveBeenNthCalledWith(
      2,
      TestAccount,
      expect.objectContaining({
        accountId: "generated-user-id",
        userId: "generated-user-id",
      }),
    );
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
    const { accessControlService, em, service } = createService();
    const user = Object.assign(new TestUser(), { id: "user-1" });
    em.findOne.mockResolvedValue(user);

    await expect(service.getUser("user-1")).resolves.toBe(user);
    await expect(service.updateUser(user, { name: "Renamed" })).resolves.toBe(
      user,
    );
    await expect(service.setUserPermissions(user, ["User:get"])).resolves.toBe(
      user,
    );

    expect(em.findOne).toHaveBeenCalledWith(
      TestUser,
      { id: "user-1" },
      { filters: false },
    );
    expect(em.assign).toHaveBeenCalledWith(user, { name: "Renamed" });
    expect(user.permissions).toEqual(["User:get"]);
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "get",
      TestUser,
    );
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "update",
      user,
    );
    await expect(
      service.updateUser(user, { roles: ["admin"] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("normalizes email addresses when updating a user", async () => {
    const { accessControlService, em, service } = createService();
    const user = Object.assign(new TestUser(), { email: "old@example.com" });

    await service.updateUser(user, { email: " New@Example.com " });

    expect(em.assign).toHaveBeenCalledWith(user, {
      email: "new@example.com",
    });
    expect(user.email).toBe("new@example.com");
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "set-email",
      user,
    );
  });

  it("only updates documented user fields", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), { id: "user-1" });

    for (const field of ["id", "createdAt", "banned", "locale"]) {
      await expect(
        service.updateUser(user, { [field]: "overwritten" } as never),
      ).rejects.toThrow(`User update contains unsupported fields: ${field}`);
    }
    expect(user.id).toBe("user-1");
    expect(em.assign).not.toHaveBeenCalled();
  });

  it("requires set-email permission when changing email verification", async () => {
    const { accessControlService, service } = createService();
    const user = Object.assign(new TestUser(), { emailVerified: false });

    await service.updateUser(user, { emailVerified: true });

    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "set-email",
      user,
    );
  });

  it("validates direct user permissions against the configured catalog", async () => {
    const { em, hash, service } = createService();
    hash.mockResolvedValue("hashed-password");

    await expect(
      service.createUser({
        email: "invalid@example.com",
        name: "Invalid",
        password: "password",
        permissions: ["Workspace:update"],
      }),
    ).rejects.toThrow("User contains unknown permissions: Workspace:update");
    expect(em.create).not.toHaveBeenCalled();

    const user = new TestUser();
    await expect(
      service.setUserPermissions(user, ["User:get", "User:get"]),
    ).rejects.toThrow("User contains duplicate permissions: User:get");
    await expect(service.setUserPermissions(user, ["User:get"])).resolves.toBe(
      user,
    );
    expect(user.permissions).toEqual(["User:get"]);
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
      permissions: ["User:create", "User:set-role", "User:list", "User:delete"],
      roles: {
        admin: ["User:create", "User:set-role"],
        auditor: ["User:list"],
        user: [],
      },
    });
    const user = Object.assign(new TestUser(), {
      permissions: ["Session:list"],
      roles: ["user"],
    });

    expect(service.listRoles()).toEqual([
      {
        name: "admin",
        permissions: ["User:create", "User:set-role"],
      },
      { name: "auditor", permissions: ["User:list"] },
      { name: "user", permissions: [] },
    ]);
    expect(service.listPermissions()).toEqual([
      "User:create",
      "User:set-role",
      "User:list",
      "User:delete",
    ]);

    await expect(service.setRole(user, ["auditor", "user"])).resolves.toBe(
      user,
    );
    expect(user.roles).toEqual(["auditor", "user"]);
    expect(service.getUserPermissions(user)).toEqual([
      "User:list",
      "Session:list",
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
      id: "session-1",
      token: "session-token",
      userId: "user-1",
    });
    em.find.mockResolvedValue([session]);
    em.findOne.mockResolvedValue(session);
    em.nativeDelete.mockResolvedValue(2);

    await expect(service.listUserSessions(user)).resolves.toEqual([session]);
    await expect(service.revokeUserSession(user, session.id)).resolves.toBe(
      true,
    );
    em.findOne.mockResolvedValueOnce(null);
    await expect(service.revokeUserSession(user, "missing")).resolves.toBe(
      false,
    );
    await expect(service.revokeUserSessions(user)).resolves.toBe(2);

    expect(em.find).toHaveBeenCalledWith(
      TestSession,
      expect.objectContaining({ userId: "user-1" }),
      { filters: false, orderBy: { createdAt: "desc" } },
    );
    expect(em.findOne).toHaveBeenCalledWith(
      TestSession,
      { id: session.id, userId: "user-1" },
      { filters: false },
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

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER])(
    "rejects an invalid ban lifetime of %s seconds",
    async (banExpiresIn) => {
      const { em, service } = createService();
      const user = new TestUser();

      await expect(service.banUser(user, { banExpiresIn })).rejects.toThrow(
        "Ban duration must be a positive integer",
      );
      expect(user.banned).toBe(false);
      expect(em.nativeDelete).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
    },
  );

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

  it("checks the scoped ability when impersonating an administrator", async () => {
    const { accessControlService, service } = createService();
    const target = Object.assign(new TestUser(), { roles: ["admin"] });
    const administrator = Object.assign(new TestUser(), {
      roles: ["admin"],
    });
    vi.mocked(accessControlService.assertUserCan).mockImplementation(
      (action) => {
        if (action === "impersonate-admins") {
          throw new ForbiddenException();
        }
      },
    );

    await expect(
      service.impersonateUser(administrator, target),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(accessControlService.assertUserCan).toHaveBeenNthCalledWith(
      1,
      "impersonate",
      target,
    );
    expect(accessControlService.assertUserCan).toHaveBeenNthCalledWith(
      2,
      "impersonate-admins",
      target,
    );
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

  it("rejects banned targets and handles incomplete impersonation state", async () => {
    const { em, service } = createService();
    const administrator = Object.assign(new TestUser(), {
      id: "admin-1",
      roles: ["admin"],
    });
    const bannedUser = Object.assign(new TestUser(), {
      banned: true,
      id: "user-1",
    });

    await expect(
      service.impersonateUser(administrator, bannedUser),
    ).rejects.toThrow("Banned users cannot be impersonated");

    const session = Object.assign(new TestSession(), {
      impersonatedBy: null,
    });
    await expect(service.stopImpersonating(session)).resolves.toBeNull();

    session.impersonatedBy = administrator;
    em.findOne.mockResolvedValue(null);
    await expect(service.stopImpersonating(session)).resolves.toBeNull();
  });

  it("propagates unexpected user deletion failures", async () => {
    const { service, userDeletionService } = createService();
    const error = new Error("database unavailable");
    userDeletionService.deleteUser.mockRejectedValue(error);

    await expect(service.removeUser(new TestUser())).rejects.toBe(error);
  });

  it("delegates user removal to the transactional deletion coordinator", async () => {
    const { service, userDeletionService } = createService();
    const user = Object.assign(new TestUser(), { id: "user-1" });

    await expect(service.removeUser(user)).resolves.toBe(user);

    expect(userDeletionService.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("maps workspace ownership conflicts to a Nest conflict response", async () => {
    const { service, userDeletionService } = createService();
    const user = Object.assign(new TestUser(), { id: "owner-1" });
    userDeletionService.deleteUser.mockRejectedValue(
      new WorkspaceOwnershipConflictError(),
    );

    await expect(service.removeUser(user)).rejects.toBeInstanceOf(
      ConflictException,
    );
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

  it("enforces the configured password length before hashing", async () => {
    const { hash, service } = createService(
      true,
      {},
      { maxPasswordLength: 16, minPasswordLength: 12 },
    );
    const user = new TestUser();

    await expect(
      service.createUser({
        email: "alice@example.com",
        name: "Alice",
        password: "too-short",
      }),
    ).rejects.toThrow("Password must contain at least 12 characters");
    await expect(
      service.setUserPassword(user, "password-that-is-too-long"),
    ).rejects.toThrow("Password must contain at most 16 characters");
    expect(hash).not.toHaveBeenCalled();
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
      permissions: ["User:list", "Session:revoke"],
    });

    expect(
      service.hasPermission(user, {
        permissions: { Session: ["revoke"], User: ["list"] },
      }),
    ).toBe(true);
    expect(
      service.hasPermission(user, {
        permissions: { User: ["delete"] },
      }),
    ).toBe(false);
  });
});

function createService(
  useCustomHash = true,
  user: NonNullable<AuthModuleOptions["user"]> = {},
  emailAndPassword: NonNullable<AuthModuleOptions["emailAndPassword"]> = {},
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
    transactional: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);
  em.remove.mockReturnValue(em);
  em.transactional.mockImplementation(async (callback) => await callback(em));
  const hash = vi.fn();
  const hashServiceHash = vi.fn();
  const hashService = {
    hash: hashServiceHash,
  } as unknown as HashService;
  const options = {
    emailAndPassword: {
      ...emailAndPassword,
      password: {
        ...emailAndPassword.password,
        ...(useCustomHash ? { hash } : {}),
      },
    },
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
  const accessControlService = {
    assertCurrentSession: vi.fn(),
    assertCurrentUser: vi.fn(),
    assertUserCan: vi.fn(),
  } as unknown as AccessControlService;
  const userDeletionService = {
    deleteUser: vi.fn(),
  } as unknown as Mocked<UserDeletionService>;
  return {
    accessControlService,
    em,
    hash,
    hashServiceHash,
    userDeletionService,
    service: new UserService<TestUser, TestAccount, TestSession>(
      em,
      options,
      hashService,
      accessControlService,
      userDeletionService,
    ),
  };
}
