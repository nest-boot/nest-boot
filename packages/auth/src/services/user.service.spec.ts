/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager, ref } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { HashService } from "@nest-boot/hash";
import { RequestContext } from "@nest-boot/request-context";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { expectTypeOf, type Mocked } from "vitest";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import { UserAbility } from "../abilities/user.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { UserConnection } from "../connections/user.connection-definition.js";
import { Account } from "../entities/account.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import type { CreateUserOptions } from "../interfaces/create-user-options.interface.js";
import type { AccessControlService } from "./access-control.service.js";
import { UserService } from "./user.service.js";
import { UserDeletionService } from "./user-deletion.service.js";

describe("UserService", () => {
  it.each(["self", "impersonator"] as const)(
    "revokes %s identity only after a ban commits",
    async (target) => {
      const { service, em } = createService();
      const user = Object.assign(new User(), {
        id: "target",
        banned: false,
        banReason: null,
        banExpiresAt: null,
      });
      const current =
        target === "self"
          ? user
          : Object.assign(new User(), { id: "impersonated" });
      const session = Object.assign(new Session(), {
        user: current,
        impersonatedBy: target === "impersonator" ? user : null,
      });
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(User, current);
          RequestContext.set(Session, session);
          em.isInTransaction.mockReturnValue(true);
          await expect(service.banUser(user)).rejects.toThrow(
            "outside an active transaction",
          );
          expect(em.transactional).not.toHaveBeenCalled();
          em.isInTransaction.mockReturnValue(false);
          em.flush.mockRejectedValueOnce(new Error("Commit failed"));
          await expect(service.banUser(user)).rejects.toThrow("Commit failed");
          expect(user.banned).toBe(false);
          expect(user.banReason).toBeNull();
          expect(user.banExpiresAt).toBeNull();
          expect(RequestContext.get(User)).toBe(current);
          expect(RequestContext.get(Session)).toBe(session);
          await service.banUser(user);
          expect(user.banned).toBe(true);
          expect(RequestContext.get(User)).toBeNull();
          expect(RequestContext.get(Session)).toBeNull();
        },
      );
    },
  );

  it.each(["roles", "permissions"] as const)(
    "refreshes own %s and abilities only after persistence succeeds",
    async (field) => {
      const { service, em } = createService(true, {
        permissions: ["user:delete"],
        roles: { admin: ["user:delete"], user: [] },
        buildAbility: (builder, permissions) => {
          if (permissions.includes("user:delete")) builder.can("delete", User);
          return builder.build();
        },
      });
      const current = Object.assign(new User(), {
        id: "self",
        roles: field === "roles" ? ["admin"] : ["user"],
        permissions: field === "permissions" ? ["user:delete"] : [],
      });
      const stored =
        field === "permissions" ? current : Object.assign(new User(), current);
      em.findOne.mockResolvedValue(stored);
      mockRlsContext(em);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          const ability = new UserAbility([
            { action: "delete", subject: User },
          ]);
          RequestContext.set(User, current);
          RequestContext.set(UserAbility, ability);
          const update = () =>
            field === "roles"
              ? service.setUserRoles(stored.id, ["user"])
              : service.setUserPermissions(stored.id, []);
          em.flush.mockRejectedValueOnce(new Error("Commit failed"));
          await expect(update()).rejects.toThrow("Commit failed");
          expect(RequestContext.get(User)).toBe(current);
          expect(RequestContext.get(UserAbility)).toBe(ability);
          expect(em.setSessionContext).not.toHaveBeenCalled();
          expect(stored[field]).toEqual(
            field === "roles" ? ["admin"] : ["user:delete"],
          );
          await update();
          expect(RequestContext.get(User)).toBe(stored);
          expect(RequestContext.get(UserAbility)?.can("delete", User)).toBe(
            false,
          );
          expect(em.setSessionContext).not.toHaveBeenCalled();
        },
      );
    },
  );

  it.each(["roles", "permissions"] as const)(
    "rejects own %s changes inside an outer transaction before modifying the identity",
    async (field) => {
      const { service, em } = createService();
      const user = Object.assign(new User(), {
        id: "self",
        roles: ["admin"],
        permissions: ["user:delete"],
      });
      em.isInTransaction.mockReturnValue(true);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(User, user);
          const result =
            field === "roles"
              ? service.setUserRoles(user, ["user"])
              : service.setUserPermissions(user, []);
          await expect(result).rejects.toThrow("outside an active transaction");
          expect(user.roles).toEqual(["admin"]);
          expect(user.permissions).toEqual(["user:delete"]);
          expect(em.flush).not.toHaveBeenCalled();
        },
      );
    },
  );

  it("does not expose unmapped data in create-user options", () => {
    expectTypeOf<
      Extract<keyof CreateUserOptions, "data">
    >().toEqualTypeOf<never>();
  });

  it("loads mutation targets by ID without requiring user:get and preserves RLS", async () => {
    const { service, em, accessControlService } = createService();
    const user = Object.assign(new User(), { id: "target" });
    em.findOne.mockResolvedValue(user);
    const session = mockRlsContext(em);
    await service.updateUser(user.id, { name: "Updated" });
    await service.setUserRoles(user.id, ["user"]);
    await service.setUserPermissions(user.id, []);
    expect(em.findOne).toHaveBeenCalledWith(
      User,
      { id: user.id },
      { refresh: true },
    );
    expect(accessControlService.assertUserCan).not.toHaveBeenCalledWith(
      "get",
      User,
    );
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
    vi.mocked(accessControlService.assertUserCan).mockImplementation(() => {
      throw new ForbiddenException();
    });
    em.findOne.mockClear();
    await expect(
      service.updateUser(user.id, { name: "Denied" }),
    ).rejects.toThrow(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
  });
  it("checks direct and inherited grants before mutation or hashing", async () => {
    const { service, accessControlService, em, hash } = createService(true, {
      defaultRole: "reader",
      permissions: ["user:get", "user:delete"],
      roles: { reader: ["user:get"], administrator: ["user:delete"] },
    });
    const user = Object.assign(new User(), {
      roles: ["reader"],
      permissions: [],
    });
    const assertGrant = vi.mocked(
      accessControlService.assertCanGrantUserPermissions,
    );
    assertGrant.mockImplementation(() => {
      throw new ForbiddenException("grant denied");
    });
    await expect(
      service.setUserPermissions(user, ["user:delete"]),
    ).rejects.toThrow("grant denied");
    expect(assertGrant).toHaveBeenLastCalledWith(["user:delete"]);
    await expect(service.setUserRoles(user, "administrator")).rejects.toThrow(
      "grant denied",
    );
    expect(assertGrant).toHaveBeenLastCalledWith(["user:delete"]);
    await expect(
      service.createUser({
        name: "New",
        email: "new@example.com",
        password: "password",
        permissions: ["user:delete"],
      }),
    ).rejects.toThrow("grant denied");
    expect(assertGrant).toHaveBeenLastCalledWith(["user:get", "user:delete"]);
    expect(user.roles).toEqual(["reader"]);
    expect(user.permissions).toEqual([]);
    expect(em.flush).not.toHaveBeenCalled();
    expect(em.create).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it("paginates users with list authorization and the request RLS context", async () => {
    const { service, em, accessControlService } = createService();
    const context = mockRlsContext(em);
    const connection = { edges: [], pageInfo: {} };
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue(connection as never);
    try {
      const args = { first: 10 };
      await expect(service.getUserConnection(args)).resolves.toBe(connection);
      expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
        "list",
        User,
      );
      expect(find).toHaveBeenCalledExactlyOnceWith(UserConnection, args);
      expect(em.fork).not.toHaveBeenCalled();
      expect(em.getSessionContext()).toEqual(context);
      find.mockClear();
      vi.mocked(accessControlService.assertUserCan).mockImplementation(() => {
        throw new ForbiddenException();
      });
      await expect(service.getUserConnection(args)).rejects.toThrow(
        ForbiddenException,
      );
      expect(find).not.toHaveBeenCalled();
    } finally {
      find.mockRestore();
    }
  });

  it("creates a user and credential account with the configured hasher", async () => {
    const { em, hash, service } = createService();
    hash.mockResolvedValue("hashed-password");

    const user = await service.createUser({
      email: " Alice@Example.com ",
      name: "Alice",
      password: "password",
      permissions: ["user:list"],
    });

    expect(hash).toHaveBeenCalledWith("password");
    expect(em.create).toHaveBeenNthCalledWith(
      1,
      User,
      expect.objectContaining({
        email: "alice@example.com",
        emailVerified: false,
        name: "Alice",
        permissions: ["user:list"],
      }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      2,
      Account,
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
      if (Entity !== User && Entity !== Account) {
        throw new Error("Unexpected entity in credential user creation");
      }
      const entity = Object.assign(
        Entity === User ? new User() : new Account(),
        input,
      );
      if (Entity === User) Reflect.deleteProperty(entity, "id");
      return entity;
    });
    em.flush.mockImplementationOnce(() => {
      const user = em.create.mock.results[0]?.value as User;
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
      Account,
      expect.objectContaining({
        accountId: "generated-user-id",
        user: expect.objectContaining({ id: "generated-user-id" }),
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
      User,
      expect.objectContaining({ roles: ["customer"] }),
    );
    expect(
      service.getEffectiveUserPermissions(
        Object.assign(new User(), { roles: undefined }),
      ),
    ).toEqual([]);
  });

  it("gets and updates configured user entities", async () => {
    const { accessControlService, em, service } = createService();
    const user = Object.assign(new User(), { id: "user-1" });
    em.findOne.mockResolvedValue(user);

    await expect(service.getUser("user-1")).resolves.toBe(user);
    await expect(service.updateUser(user, { name: "Renamed" })).resolves.toBe(
      user,
    );
    await expect(service.setUserPermissions(user, ["user:get"])).resolves.toBe(
      user,
    );

    expect(em.findOne).toHaveBeenCalledWith(User, { id: "user-1" });
    expect(em.assign).toHaveBeenCalledWith(user, { name: "Renamed" });
    expect(user.permissions).toEqual(["user:get"]);
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "get",
      User,
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
    const user = Object.assign(new User(), { email: "old@example.com" });

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

  it("ignores omitted DTO fields without requiring email permission or clearing profile values", async () => {
    const { accessControlService, em, service } = createService();
    const user = Object.assign(new User(), {
      name: "Original",
      email: "original@example.com",
      emailVerified: true,
      image: "avatar.png",
    });
    await service.updateUser(user, {
      name: "Renamed",
      email: undefined,
      emailVerified: undefined,
      image: undefined,
    });
    expect(em.assign).toHaveBeenLastCalledWith(user, { name: "Renamed" });
    expect(user.email).toBe("original@example.com");
    expect(user.emailVerified).toBe(true);
    expect(user.image).toBe("avatar.png");
    expect(accessControlService.assertUserCan).not.toHaveBeenCalledWith(
      "set-email",
      user,
    );

    await service.updateUser(user, { name: undefined, image: null });
    expect(em.assign).toHaveBeenLastCalledWith(user, { image: null });
    expect(user.name).toBe("Renamed");
    expect(user.image).toBeNull();
  });

  it("only updates documented user fields", async () => {
    const { em, service } = createService();
    const user = Object.assign(new User(), { id: "user-1" });

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
    const user = Object.assign(new User(), { emailVerified: false });

    await service.updateUser(user, { emailVerified: true });

    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "set-email",
      user,
    );
  });

  it("stores configured permission casing and compares grants exactly", async () => {
    const { service } = createService(true, {
      permissions: ["User:READ", "user:read"],
      roles: { user: [] },
    });
    const user = new User();
    await service.setUserPermissions(user, ["User:READ"]);
    expect(user.permissions).toEqual(["User:READ"]);
    expect(
      service.hasPermissions(user, { permissions: { User: ["READ"] } }),
    ).toBe(true);
    expect(
      service.hasPermissions(user, { permissions: { user: ["read"] } }),
    ).toBe(false);
    await expect(
      service.setUserPermissions(user, ["User:read"]),
    ).rejects.toThrow("contains unknown permissions: User:read");
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

    const user = new User();
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
    const user = Object.assign(new User(), {
      email: "alice@example.com",
      id: "user-1",
    });
    em.findOne.mockResolvedValue(user);

    await expect(service.getUserByEmail(" Alice@Example.com ")).resolves.toBe(
      user,
    );
    expect(em.findOne).toHaveBeenCalledWith(User, {
      email: "alice@example.com",
    });
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
    const user = Object.assign(new User(), {
      permissions: ["session:list"],
      roles: ["user"],
    });

    expect(service.listRoles()).toEqual([
      { role: "admin", grantable: true },
      { role: "auditor", grantable: true },
      { role: "user", grantable: true },
    ]);
    expect(service.listPermissions()).toEqual(
      ["user:create", "user:set-role", "user:list", "user:delete"].map(
        (permission) => ({ permission, grantable: true }),
      ),
    );

    await expect(service.setUserRoles(user, ["auditor", "user"])).resolves.toBe(
      user,
    );
    expect(user.roles).toEqual(["auditor", "user"]);
    expect(service.getEffectiveUserPermissions(user)).toEqual([
      "user:list",
      "session:list",
    ]);
    await expect(
      service.setUserRoles(user, ["unknown"]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("keeps all role and permission options while marking grant availability", () => {
    const { service, accessControlService } = createService(true, {
      permissions: ["user:get", "user:delete"],
      roles: {
        reader: ["user:get"],
        admin: ["user:get", "user:delete"],
        user: [],
      },
    });
    vi.mocked(accessControlService.canGrantUserPermissions).mockImplementation(
      (permissions) =>
        permissions.every((permission) => permission === "user:get"),
    );
    expect(service.listRoles()).toEqual([
      { role: "reader", grantable: true },
      { role: "admin", grantable: false },
      { role: "user", grantable: true },
    ]);
    expect(service.listPermissions()).toEqual([
      { permission: "user:get", grantable: true },
      { permission: "user:delete", grantable: false },
    ]);
    vi.mocked(accessControlService.assertUserCan).mockImplementation(() => {
      throw new ForbiddenException();
    });
    expect(() => service.listRoles()).toThrow(ForbiddenException);
    expect(() => service.listPermissions()).toThrow(ForbiddenException);
  });

  it("classifies users with any configured admin role as administrators", () => {
    const { service } = createService(true, {
      adminRoles: ["admin", "superadmin"],
      permissions: [],
      roles: { admin: [], superadmin: [], user: [] },
    });

    expect(
      service.isAdmin(Object.assign(new User(), { roles: ["auditor"] })),
    ).toBe(false);
    expect(
      service.isAdmin(
        Object.assign(new User(), { roles: ["auditor", "superadmin"] }),
      ),
    ).toBe(true);
  });

  it("resolves administration targets by ID with action permissions, not user:get", async () => {
    const { em, service, accessControlService } = createService();
    const user = Object.assign(new User(), { id: "user-1" });
    em.findOne.mockResolvedValue(user);
    await service.banUser(user.id);
    await service.unbanUser(user.id);
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "ban",
      User,
    );
    expect(accessControlService.assertUserCan).not.toHaveBeenCalledWith(
      "get",
      User,
    );
    expect(em.findOne).toHaveBeenCalledWith(
      User,
      { id: user.id },
      { refresh: true },
    );
    vi.mocked(accessControlService.assertUserCan).mockImplementation(() => {
      throw new ForbiddenException();
    });
    em.findOne.mockClear();
    await expect(service.banUser(user.id)).rejects.toThrow(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
  });
  it("bans, revokes sessions, and unbans a user", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00Z"));
    const { em, service } = createService();
    const user = new User();
    em.nativeDelete.mockResolvedValue(1);

    await service.banUser(user, {
      banExpiresIn: 3600,
      banReason: "abuse",
    });
    expect(user.banned).toBe(true);
    expect(user.banReason).toBe("abuse");
    expect(user.banExpiresAt).toEqual(new Date("2026-09-02T01:00:00Z"));
    expect(em.nativeDelete).toHaveBeenCalledTimes(1);
    expect(em.nativeDelete).toHaveBeenCalledWith(Session, {
      $or: [{ user: user.id }, { impersonatedBy: user }],
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
      const user = new User();

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
    const administrator = Object.assign(new User(), {
      id: "admin-1",
      roles: ["admin"],
    });
    const user = Object.assign(new User(), { id: "user-1" });

    const impersonation = await service.impersonateUser(administrator, user, {
      ipAddress: "127.0.0.1",
    });
    expect(impersonation.user).toBe(user);
    expect(impersonation.session.impersonatedBy).toBe(administrator);
    expect(impersonation.session.user.id).toBe("user-1");

    em.findOne.mockResolvedValue(administrator);
    const restored = await service.stopImpersonating(impersonation.session);
    expect(restored?.user).toBe(administrator);
    expect(restored?.session.user.id).toBe("admin-1");
    expect(em.remove).toHaveBeenCalledWith(impersonation.session);
  });

  it("checks the scoped ability when impersonating an administrator", async () => {
    const { accessControlService, service } = createService();
    const target = Object.assign(new User(), { roles: ["admin"] });
    const administrator = Object.assign(new User(), {
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
    const administrator = Object.assign(new User(), {
      banned: true,
      banExpiresAt: null,
      id: "admin-1",
    });
    const user = Object.assign(new User(), { id: "user-1" });
    const impersonation = await service.impersonateUser(
      Object.assign(new User(), { id: "issuer-1", roles: ["admin"] }),
      user,
    );
    impersonation.session.impersonatedBy = ref(User, administrator);
    em.findOne.mockResolvedValue(administrator);
    let committed = false;
    em.transactional.mockImplementation(async (callback) => {
      const result = await callback(em);
      committed = true;
      return result;
    });

    await expect(
      service.stopImpersonating(impersonation.session),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.remove).toHaveBeenCalledWith(impersonation.session);
    expect(em.flush).toHaveBeenCalled();
    expect(committed).toBe(true);
  });

  it("rejects banned targets and handles incomplete impersonation state", async () => {
    const { em, service } = createService();
    const administrator = Object.assign(new User(), {
      id: "admin-1",
      roles: ["admin"],
    });
    const bannedUser = Object.assign(new User(), {
      banned: true,
      id: "user-1",
    });

    await expect(
      service.impersonateUser(administrator, bannedUser),
    ).rejects.toThrow("Banned users cannot be impersonated");

    const session = new Session();
    session.impersonatedBy = null;
    await expect(service.stopImpersonating(session)).resolves.toBeNull();

    session.impersonatedBy = ref(User, administrator);
    em.findOne.mockResolvedValue(null);
    await expect(service.stopImpersonating(session)).resolves.toBeNull();
  });

  it("propagates unexpected user deletion failures", async () => {
    const { service, userDeletionService } = createService();
    const error = new Error("database unavailable");
    userDeletionService.deleteUser.mockRejectedValue(error);

    await expect(service.deleteUser(new User())).rejects.toBe(error);
  });

  it("delegates user deletion to the transactional deletion coordinator", async () => {
    const { service, userDeletionService } = createService();
    const user = Object.assign(new User(), { id: "user-1" });

    await expect(service.deleteUser(user)).resolves.toBe(user);

    expect(userDeletionService.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("does not report success when the user disappears before deletion", async () => {
    const { service, userDeletionService } = createService();
    userDeletionService.deleteUser.mockResolvedValue(null);

    await expect(service.deleteUser(new User())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("sets an existing credential password or creates the account", async () => {
    const { em, hash, service } = createService();
    const user = Object.assign(new User(), { id: "user-1" });
    const account = Object.assign(new Account(), {
      password: "old-hash",
    });
    hash.mockResolvedValueOnce("new-hash").mockResolvedValueOnce("first-hash");
    em.findOne.mockResolvedValueOnce(account).mockResolvedValueOnce(null);

    await service.setUserPassword(user, "new-password");
    expect(account.password).toBe("new-hash");

    await service.setUserPassword(user, "first-password");
    expect(em.create).toHaveBeenLastCalledWith(
      Account,
      expect.objectContaining({
        issuer: "local:credential",
        password: "first-hash",
        providerId: "credential",
        user: expect.objectContaining({ id: "user-1" }),
      }),
    );
  });

  it("accepts shorter passwords only when the configured minimum permits them", async () => {
    const { hash, service } = createService(true, {}, { minPasswordLength: 6 });
    const user = new User();
    hash.mockResolvedValue("password-hash");

    await service.createUser({
      email: "alice@example.com",
      name: "Alice",
      password: "123456",
    });
    await service.setUserPassword(user, "123456");
    expect(hash).toHaveBeenCalledTimes(2);
    expect(hash).toHaveBeenLastCalledWith("123456");

    await expect(service.setUserPassword(user, "12345")).rejects.toThrow(
      "Password must contain at least 6 characters",
    );
    expect(hash).toHaveBeenCalledTimes(2);

    const defaults = createService();
    await expect(
      defaults.service.setUserPassword(user, "123456"),
    ).rejects.toThrow("Password must contain at least 8 characters");
    expect(defaults.hash).not.toHaveBeenCalled();
  });

  it("enforces the configured password length before hashing", async () => {
    const { hash, service } = createService(
      true,
      {},
      { maxPasswordLength: 16, minPasswordLength: 12 },
    );
    const user = new User();

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
    const user = Object.assign(new User(), {
      permissions: ["user:list", "session:revoke"],
    });

    expect(
      service.hasPermissions(user, {
        permissions: { session: ["revoke"], user: ["list"] },
      }),
    ).toBe(true);
    expect(
      service.hasPermissions(user, {
        permissions: { user: ["delete"] },
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
    setSessionContext: vi.fn(),
    getContext: vi.fn().mockReturnThis(),
    getSessionContext:
      vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
    isInTransaction: vi.fn(() => false),
    fork: vi.fn(),
    assign: vi.fn((entity, input) => Object.assign(entity, input)),
    create: vi.fn((Entity, input) => Object.assign(new Entity(), input)),
    find: vi.fn(),
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
    session: { expiresIn: 3600 },
  } as unknown as AuthModuleOptions;
  const accessControlService = {
    canGrantUserPermissions: vi.fn().mockReturnValue(true),
    assertCanGrantUserPermissions: vi.fn(),
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
    service: new UserService(
      em,
      options,
      hashService,
      accessControlService,
      userDeletionService,
    ),
  };
}
