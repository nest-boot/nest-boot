/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager, ref, Reference } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { it as baseIt, type Mocked } from "vitest";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import { AuthAbility } from "../auth.ability.js";
import { API_KEY } from "../auth.constants.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { MemberApiKeyConnection } from "../connections/member-api-key.connection-definition.js";
import { UserApiKeyConnection } from "../connections/user-api-key.connection-definition.js";
import { Member } from "../entities/member.entity.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { MemberType } from "../enums/member-type.enum.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import * as abilityHelpers from "../utils/authorize.util.js";
import { omitCredentials } from "../utils/omit-credentials.util.js";
import { MemberApiKeyService } from "./member-api-key.service.js";
import { UserApiKeyService } from "./user-api-key.service.js";

function createTestWorkspace(): Workspace {
  return Object.assign(new Workspace(), {
    id: "workspace-1",
    name: "Acme",
  });
}

function createTestUser(): User {
  return Object.assign(new User(), {
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    emailVerified: true,
  });
}

function createTestMember(): Member {
  return Object.assign(new Member(), {
    id: "member-1",
    roles: ["owner"],
    status: "ACTIVE",
    user: ref(User, createTestUser()),
    permissions: [],
    workspace: {
      id: "workspace-1",
    } as Member["workspace"],
  });
}

function createTestApiKey(): MemberApiKey {
  return Object.assign(new MemberApiKey(), {
    id: "api-key-1",
    name: "Deploy key",
    start: "sk012345",
    prefix: "sk",
    key: "hashed-key",
    enabled: true,
    permissions: [],
    updatedAt: new Date(),
    lastUsedAt: null,
    expiresAt: null,
    member: ref(Member, createTestMember()),
  });
}

describe("API-key management services", () => {
  it("uses the current member when no owner is supplied", async () => {
    const { service } = createService();
    const current = RequestContext.get(Member);
    const created = await service.createMemberApiKey(createTestWorkspace(), {
      name: "Own key",
      permissions: [],
    });
    expect(created.entity.member).toBe(current);
  });

  it("accepts a member entity without creating another service account", async () => {
    const { service } = createService();
    const member = createTestMember();
    const created = await service.createMemberApiKey(createTestWorkspace(), {
      name: "Own key",
      member,
    });
    expect(created.entity.member).toBe(member);
  });

  for (const scope of ["user", "member"] as const) {
    it(`prevents a restricted ${scope} key from creating or managing inherited keys`, async () => {
      const { service, em } = createService();
      const member = createTestMember();
      const user = createTestUser();
      const Key = scope === "user" ? UserApiKey : MemberApiKey;
      const target = Object.assign(new Key(), {
        member,
        user,
        permissions: [],
      });
      em.findOne.mockResolvedValue(target);
      RequestIdentity.stage({
        apiKey: Object.assign(new Key(), {
          member,
          user,
          permissions: ["workspace:read"],
        }),
      });
      await expect(
        scope === "user"
          ? service.createUserApiKey(user, { name: "Broader", permissions: [] })
          : service.createMemberApiKey(createTestWorkspace(), {
              name: "Broader",
              member,
              permissions: [],
            }),
      ).rejects.toThrow("Unrestricted API keys");
      await expect(
        scope === "user"
          ? service.deleteUserApiKey(target.id)
          : service.deleteMemberApiKey(target.id),
      ).rejects.toThrow("Unrestricted API keys");
      expect(em.flush).not.toHaveBeenCalled();
      expect(em.remove).not.toHaveBeenCalled();
    });
  }

  for (const source of ["explicit", "default"]) {
    it(`rejects ${source} grants above the target service account even when the issuer has them`, async () => {
      const { service, em } = createService({
        apiKey: { member: { defaultPermissions: ["workspace:delete"] } },
      });
      const target: Member = Object.assign(createTestMember(), {
        id: "service-member",
        type: MemberType.SERVICE_ACCOUNT,
        user: null,
        roles: ["member"],
        permissions: [],
      });
      em.findOne.mockResolvedValue(target);
      await expect(
        service.createMemberApiKey(createTestWorkspace(), {
          name: "Deploy",
          member: target.id,
          ...(source === "explicit"
            ? { permissions: ["workspace:delete"] }
            : {}),
        }),
      ).rejects.toThrow("Member API key permissions exceed owner permissions");
      expect(em.persist).not.toHaveBeenCalled();
    });
  }

  it("issues only role and direct grants of the target member and enforces them on updates", async () => {
    const { service, em } = createService();
    const target: Member = Object.assign(createTestMember(), {
      id: "service-member",
      type: MemberType.SERVICE_ACCOUNT,
      user: null,
      roles: ["member"],
      permissions: ["workspace:update"],
    });
    em.findOne.mockResolvedValue(target);
    const { entity } = await service.createMemberApiKey(createTestWorkspace(), {
      name: "Deploy",
      member: target.id,
      permissions: ["member:read", "workspace:update"],
    });
    em.findOne.mockResolvedValue(entity);
    em.flush.mockClear();
    await expect(
      service.updateMemberApiKey(entity.id, {
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow("Member API key permissions exceed owner permissions");
    expect(em.flush).not.toHaveBeenCalled();
    target.permissions = [];
    await expect(
      service.updateMemberApiKey(entity.id, { enabled: true }),
    ).rejects.toThrow("Member API key permissions exceed owner permissions");
    await expect(
      service.updateMemberApiKey(entity.id, { enabled: false }),
    ).resolves.toMatchObject({ enabled: false });
  });

  for (const kind of [
    "self",
    "other-user",
    "service-account",
    "disabled",
    "foreign-workspace",
    "missing",
  ]) {
    it(`checks the member owner before issuing a key: ${kind}`, async () => {
      const { service, em } = createService();
      const target = Object.assign(createTestMember(), { id: "target-member" });
      if (kind === "other-user")
        target.user = ref(
          User,
          Object.assign(createTestUser(), { id: "other-user" }),
        );
      if (kind === "service-account") {
        target.type = MemberType.SERVICE_ACCOUNT;
        target.user = null;
      }
      if (kind === "disabled") target.status = "DISABLED";
      if (kind === "foreign-workspace")
        target.workspace = ref(
          Workspace,
          Object.assign(createTestWorkspace(), { id: "foreign" }),
        );
      em.findOne.mockResolvedValue(kind === "missing" ? null : target);
      const create = service.createMemberApiKey(createTestWorkspace(), {
        name: "Key",
        member: target.id,
      });
      if (kind === "self" || kind === "service-account") {
        await expect(create).resolves.toMatchObject({
          entity: { member: target },
        });
        expect(em.create).toHaveBeenCalledWith(
          MemberApiKey,
          expect.objectContaining({ member: target }),
        );
      } else {
        await expect(create).rejects.toThrow();
        expect(em.create).not.toHaveBeenCalled();
        expect(em.persist).not.toHaveBeenCalled();
      }
    });
  }

  it("rejects keys without an owner before any write", async () => {
    const { service, em } = createService();
    for (const Entity of [UserApiKey, MemberApiKey]) {
      const key = new Entity();
      em.findOne.mockResolvedValue(key);
      const update =
        Entity === UserApiKey
          ? service.updateUserApiKey(key.id, { name: "Denied" })
          : service.updateMemberApiKey(key.id, { name: "Denied" });
      await expect(update).rejects.toThrow("API key owner is missing");
    }
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("keeps allowlists and default selections isolated between key scopes", async () => {
    const { service } = createService({
      apiKey: {
        user: { allowedPermissions: [], defaultPermissions: [] },
        member: {
          allowedPermissions: ["workspace:update"],
          defaultPermissions: ["workspace:update"],
        },
      },
    });
    expect(
      service
        .getUserApiKeyPermissions(createTestUser())
        .every((option) => !option.grantable && !option.default),
    ).toBe(true);
    expect(
      service.getMemberApiKeyPermissions(createTestWorkspace()),
    ).toContainEqual({
      permission: "workspace:update",
      default: true,
      grantable: true,
    });
    await expect(
      service.createUserApiKey(createTestUser(), {
        name: "Denied",
        permissions: ["workspace:update"],
      }),
    ).rejects.toThrow("configured allowedPermissions");
    await expect(
      service.createMemberApiKey(createTestWorkspace(), {
        member: RequestContext.get(Member),
        name: "Allowed",
      }),
    ).resolves.toMatchObject({ entity: { permissions: ["workspace:update"] } });
  });
  it("reports configured defaults independently of grantability for both key scopes", () => {
    const { service } = createService({
      apiKey: {
        user: { defaultPermissions: ["workspace:update", "member:write"] },
        member: {
          defaultPermissions: ["workspace:update", "member:write"],
        },
      },
    });
    RequestContext.set(
      Member,
      Object.assign(createTestMember(), {
        roles: ["member"],
        permissions: ["workspace:update"],
      }),
    );
    RequestContext.set(
      API_KEY,
      Object.assign(new UserApiKey(), {
        user: ref(User, createTestUser()),
        permissions: ["workspace:update"],
      }),
    );
    for (const options of [
      service.getUserApiKeyPermissions(createTestUser()),
      service.getMemberApiKeyPermissions(createTestWorkspace()),
    ]) {
      expect(options).toContainEqual({
        permission: "workspace:update",
        grantable: true,
        default: true,
      });
      expect(options).toContainEqual({
        permission: "member:write",
        grantable: false,
        default: true,
      });
      expect(
        options
          .filter((option) => option.default)
          .map((option) => option.permission)
          .sort(),
      ).toEqual(["member:write", "workspace:update"]);
    }
  });

  it("does not invent defaults when none are configured", () => {
    const { service } = createService();
    expect(service.getUserApiKeyPermissions(createTestUser())).toEqual(
      expect.arrayContaining([expect.objectContaining({ default: false })]),
    );
    expect(
      service
        .getMemberApiKeyPermissions(createTestWorkspace())
        .every((option) => !option.default),
    ).toBe(true);
  });

  it("reports key grantability using both caller ceilings and configuration", () => {
    const { service } = createService({
      apiKey: {
        user: {
          allowedPermissions: [
            "member:write",
            "user:read",
            "user:delete",
            "member:invite",
          ],
        },
        member: {
          allowedPermissions: [
            "member:write",
            "user:read",
            "user:delete",
            "member:invite",
          ],
        },
      },
    });
    const user = Object.assign(createTestUser(), {
      roles: ["user"],
      permissions: ["user:read"],
    });
    RequestContext.set(User, user);
    RequestContext.set(
      Member,
      Object.assign(createTestMember(), {
        roles: ["member"],
        permissions: ["workspace:update", "member:write"],
      }),
    );
    const workspaceOptions = service.getMemberApiKeyPermissions(
      createTestWorkspace(),
    );
    expect(
      workspaceOptions
        .filter((option) => option.grantable)
        .map((option) => option.permission),
    ).toEqual(["member:write"]);
    expect(workspaceOptions).toContainEqual({
      permission: "member:invite",
      grantable: false,
      default: false,
    });
    const userOptions = service.getUserApiKeyPermissions(user);
    expect(userOptions).toContainEqual({
      permission: "user:read",
      grantable: true,
      default: false,
    });
    expect(userOptions).toContainEqual({
      permission: "user:delete",
      grantable: false,
      default: false,
    });
    expect(userOptions).toContainEqual({
      permission: "workspace:update",
      grantable: false,
      default: false,
    });
    expect(userOptions).toContainEqual({
      permission: "member:invite",
      grantable: true,
      default: false,
    });
    RequestIdentity.stage({
      apiKey: Object.assign(new UserApiKey(), {
        user: ref(User, user),
        permissions: ["user:read"],
      }),
    });
    expect(
      service
        .getUserApiKeyPermissions(user)
        .filter((option) => option.grantable)
        .map((option) => option.permission),
    ).toEqual(["user:read"]);
  });
  it("does not revoke a user credential when a workspace key has the same ID", async () => {
    const { service, em } = createService();
    const user = createTestUser();
    const active = Object.assign(new UserApiKey(), {
      id: "same-id",
      user: ref(User, user),
      permissions: ["workspace:update"],
    });
    const target = Object.assign(createTestApiKey(), {
      id: active.id,
      permissions: ["workspace:update"],
    });
    const ability = new AuthAbility();
    RequestContext.set(User, user);
    RequestContext.set(API_KEY, active);
    RequestContext.set(AuthAbility, ability);
    em.findOne.mockResolvedValue(target);
    em.isInTransaction.mockReturnValue(true);
    mockRlsContext(em);
    await service.updateMemberApiKey(target.id, { enabled: false });
    expect(target.lastUsedAt).toBeNull();
    expect(RequestContext.get(API_KEY)).toBe(active);
    expect(RequestContext.get(User)).toBe(user);
    expect(RequestContext.get(AuthAbility)).toBe(ability);
    expect(em.setSessionContext).not.toHaveBeenCalled();
  });

  for (const scope of ["user", "workspace"] as const) {
    it(`checks conditional read restrictions on the loaded ${scope} key`, async () => {
      const options: AuthModuleOptions = {
        buildAbility: ({ cannot }) => {
          cannot("read", UserApiKey, { enabled: false });
          cannot("read", MemberApiKey, { enabled: false });
        },
      };
      const { service, em, authorization } = createService(options);
      vi.mocked(authorization.authorize).mockRestore();
      const user = Object.assign(createTestUser(), { roles: ["admin"] });
      RequestIdentity.stage({ user });
      RequestIdentity.prepare(options);
      const key = Object.assign(
        scope === "user" ? new UserApiKey() : new MemberApiKey(),
        {
          id: "conditional-key",
          key: "already-hydrated-key-hash",
          enabled: true,
          permissions: [],
          user: ref(User, user),
          member: ref(Member, createTestMember()),
        },
      );
      const read = () =>
        scope === "user"
          ? service.getUserApiKey(key.id, user)
          : service.getMemberApiKey(key.id, createTestWorkspace());
      em.findOne.mockResolvedValue(key);
      expect(await read()).toEqual(omitCredentials(key, ["key"]));
      expect(await read()).not.toHaveProperty("key");
      expect(key.key).toBe("already-hydrated-key-hash");
      key.enabled = false;
      await expect(read()).rejects.toThrow(ForbiddenException);
      em.findOne.mockResolvedValue(null);
      await expect(read()).resolves.toBeNull();
    });

    it(`rejects a ${scope} connection page containing a conditionally denied key without changing pagination`, async () => {
      const options: AuthModuleOptions = {
        buildAbility: ({ cannot }) => {
          cannot("read", UserApiKey, { enabled: false });
          cannot("read", MemberApiKey, { enabled: false });
        },
      };
      const { service, authorization } = createService(options);
      vi.mocked(authorization.authorize).mockRestore();
      const user = Object.assign(createTestUser(), { roles: ["admin"] });
      RequestIdentity.stage({ user });
      RequestIdentity.prepare(options);
      const key = Object.assign(
        scope === "user" ? new UserApiKey() : new MemberApiKey(),
        { enabled: true, member: ref(Member, createTestMember()) },
      );
      const result = {
        edges: [{ cursor: "cursor", node: key }],
        totalCount: 2,
        pageInfo: { hasNextPage: true, endCursor: "cursor" },
      };
      vi.spyOn(ConnectionManager.prototype, "find").mockResolvedValue(
        result as never,
      );
      const read = () =>
        scope === "user"
          ? service.getUserApiKeyConnection(user, { first: 1 })
          : service.getMemberApiKeyConnection(createTestWorkspace(), {
              first: 1,
            });
      await expect(read()).resolves.toEqual({
        ...result,
        edges: result.edges.map((edge) => ({
          ...edge,
          node: omitCredentials(edge.node, [
            "key",
            "token",
            "password",
            "accessToken",
            "refreshToken",
            "idToken",
          ]),
        })),
      });
      key.enabled = false;
      await expect(read()).rejects.toThrow(ForbiddenException);
      expect(result.edges).toHaveLength(1);
      expect(result.totalCount).toBe(2);
      expect(result.pageInfo).toEqual({
        hasNextPage: true,
        endCursor: "cursor",
      });
    });

    for (const reason of ["catalog", "owner"] as const) {
      it(`allows disabling a ${scope} key with stale ${reason} grants but still rejects re-enabling it`, async () => {
        const options: AuthModuleOptions =
          reason === "catalog"
            ? {
                apiKey: {
                  user: { allowedPermissions: ["user-api-key:write"] },
                  member: {
                    allowedPermissions: ["member-api-key:write"],
                  },
                },
              }
            : {};
        const { service, em, authorization } = createService(options);
        vi.mocked(authorization.authorize).mockRestore();
        const user = Object.assign(createTestUser(), {
          roles: [reason === "owner" ? "user" : "admin"],
          permissions: ["user-api-key:write"],
        });
        const member = Object.assign(createTestMember(), {
          roles: [reason === "owner" ? "member" : "owner"],
          permissions: ["member-api-key:write"],
        });
        RequestIdentity.stage({ user, member });
        RequestIdentity.prepare(options);
        const permissions = [
          scope === "user" ? "user:read" : "workspace:delete",
        ];
        const key = Object.assign(
          scope === "user" ? new UserApiKey() : new MemberApiKey(),
          {
            id: "stale-key",
            enabled: true,
            permissions,
            user: ref(User, user),
            member: ref(Member, createTestMember()),
          },
        );
        em.findOne.mockResolvedValue(key);
        const update =
          scope === "user"
            ? service.updateUserApiKey
            : service.updateMemberApiKey;
        expect(await update(key.id, { enabled: false })).toEqual(
          omitCredentials(key, ["key"]),
        );
        expect(key.enabled).toBe(false);
        expect(key.permissions).toEqual(permissions);
        expect(em.flush).toHaveBeenCalledOnce();
        await expect(update(key.id, { enabled: true })).rejects.toThrow();
        await expect(
          update(key.id, { name: "Still invalid" }),
        ).rejects.toThrow();
        await expect(
          update(key.id, { enabled: false, permissions }),
        ).rejects.toThrow();
        expect(key.enabled).toBe(false);
        expect(em.flush).toHaveBeenCalledOnce();
      });
    }

    it(`rejects missing ${scope} keys and invalid expiration changes without persistence`, async () => {
      const { em, service } = createService();
      const user = createTestUser();
      RequestContext.set(User, user);
      const key =
        scope === "user"
          ? Object.assign(new UserApiKey(), {
              id: "key",
              user: ref(User, user),
              name: "Original",
              permissions: [],
              expiresAt: new Date(Date.now() + 60000),
            })
          : createTestApiKey();
      const update = (input: { expiresAt?: Date | null; name?: string }) =>
        scope === "user"
          ? service.updateUserApiKey(key.id, input)
          : service.updateMemberApiKey(key.id, input);
      const remove = () =>
        scope === "user"
          ? service.deleteUserApiKey(key.id)
          : service.deleteMemberApiKey(key.id);
      em.findOne.mockResolvedValue(null);
      await expect(update({ name: "Missing" })).rejects.toThrow(
        "API key not found",
      );
      await expect(remove()).rejects.toThrow("API key not found");
      em.findOne.mockResolvedValue(key);
      const original = { name: key.name, expiresAt: key.expiresAt };
      await expect(
        update({ name: "Must not change", expiresAt: new Date(0) }),
      ).rejects.toThrow("expiration must be in the future");
      await expect(
        scope === "user"
          ? service.createUserApiKey(user, {
              name: "Expired",
              expiresAt: new Date(0),
            })
          : service.createMemberApiKey(createTestWorkspace(), {
              member: RequestContext.get(Member),
              name: "Expired",
              expiresAt: new Date(0),
            }),
      ).rejects.toThrow("expiration must be in the future");
      expect(key).toMatchObject(original);
      expect(em.flush).not.toHaveBeenCalled();
      expect(em.create).not.toHaveBeenCalled();
      await update({ expiresAt: null });
      expect(key.expiresAt).toBeNull();
      expect(em.flush).toHaveBeenCalledOnce();
    });

    for (const operation of ["permissions", "disable", "delete"] as const) {
      it(`publishes ${scope} credential ${operation} changes only after commit`, async () => {
        const { service, em } = createService();
        const user = createTestUser();
        const key = Object.assign(
          scope === "user" ? new UserApiKey() : new MemberApiKey(),
          {
            id: "active-key",
            enabled: true,
            permissions: ["workspace:update", "workspace:read"],
            lastUsedAt: new Date(0),
            user: ref(User, user),
            member: ref(Member, createTestMember()),
          },
        );
        if (scope === "user") RequestContext.set(User, user);
        RequestContext.set(API_KEY, key);
        const ability = new AuthAbility([
          { action: "update", subject: Workspace },
        ]);
        RequestContext.set(AuthAbility, ability);
        em.findOne.mockResolvedValue(key);
        mockRlsContext(em).variables = {
          "app.user.id": user.id,
          "app.workspace.id": createTestWorkspace().id,
          "app.member.id": createTestMember().id,
        };
        const update =
          scope === "user"
            ? service.updateUserApiKey
            : service.updateMemberApiKey;
        const remove =
          scope === "user"
            ? service.deleteUserApiKey
            : service.deleteMemberApiKey;
        const invoke = () =>
          operation === "delete"
            ? remove(key.id)
            : update(
                key.id,
                operation === "disable"
                  ? { enabled: false }
                  : { permissions: ["workspace:read"] },
              );
        em.isInTransaction.mockReturnValueOnce(true);
        await expect(invoke()).rejects.toThrow("outside an active transaction");
        expect(em.flush).not.toHaveBeenCalled();
        em.flush.mockRejectedValueOnce(new Error("Commit failed"));
        await expect(invoke()).rejects.toThrow("Commit failed");
        expect(RequestContext.get(API_KEY)).toBe(key);
        expect(key.enabled).toBe(true);
        expect(key.lastUsedAt).toEqual(new Date(0));
        expect(key.permissions).toEqual(["workspace:update", "workspace:read"]);
        expect(RequestContext.get(AuthAbility)).toBe(ability);
        expect(em.setSessionContext).not.toHaveBeenCalled();
        em.flush.mockImplementationOnce(() => {
          expect(RequestContext.get(API_KEY)).toBe(key);
          expect(em.setSessionContext).not.toHaveBeenCalled();
          if (operation === "disable")
            expect(key.lastUsedAt?.getTime()).toBeGreaterThan(0);
          return Promise.resolve();
        });
        await invoke();
        if (operation === "disable")
          expect(key.lastUsedAt?.getTime()).toBeGreaterThan(0);
        expect(RequestContext.get(AuthAbility)?.can("update", Workspace)).toBe(
          false,
        );
        if (operation === "permissions") {
          expect(RequestContext.get(API_KEY)).toBe(key);
          expect(em.setSessionContext).not.toHaveBeenCalled();
        } else {
          expect(RequestContext.get(API_KEY)).toBeNull();
          expect(RequestContext.get(User)).toBeNull();
          expect(RequestContext.get(Member)).toBeNull();
          expect(RequestContext.get(Workspace)).toBeNull();
          expect(em.setSessionContext).toHaveBeenCalledWith({
            role: "anonymous",
            variables: {
              "app.user.id": "",
              "app.workspace.id": "",
              "app.member.id": "",
            },
          });
        }
      });
    }

    for (const action of ["update", "delete"] as const) {
      it(`checks ${scope} ${action} ability against the loaded API key`, async () => {
        const { service, em, authorization } = createService();
        const key = Object.assign(
          scope === "user" ? new UserApiKey() : new MemberApiKey(),
          {
            user: scope === "user" ? ref(User, createTestUser()) : null,
            member:
              scope === "workspace" ? ref(Member, createTestMember()) : null,
          },
        );
        em.findOne.mockResolvedValue(key);
        const assertion =
          scope === "user" ? authorization.authorize : authorization.authorize;
        vi.mocked(assertion).mockImplementation((_action, subject) => {
          if (subject === key) throw new ForbiddenException();
        });

        const operation =
          scope === "user"
            ? action === "update"
              ? () => service.updateUserApiKey(key.id, { name: "Denied" })
              : () => service.deleteUserApiKey(key.id)
            : action === "update"
              ? () => service.updateMemberApiKey(key.id, { name: "Denied" })
              : () => service.deleteMemberApiKey(key.id);

        await expect(operation()).rejects.toBeInstanceOf(ForbiddenException);
        expect(assertion).toHaveBeenCalledWith(
          "write",
          scope === "user" ? UserApiKey : MemberApiKey,
        );
        expect(assertion).toHaveBeenLastCalledWith("write", key);
        expect(key.name).not.toBe("Denied");
        expect(em.flush).not.toHaveBeenCalled();
        expect(em.remove).not.toHaveBeenCalled();
      });
    }
  }

  it("keeps update/delete in the request RLS context and excludes the credential hash", async () => {
    const { service, em } = createService();
    const context = mockRlsContext(em);
    const key = createTestApiKey();
    em.findOne.mockResolvedValue(key);
    await service.updateMemberApiKey(key.id, { name: "Scoped update" });
    await service.deleteMemberApiKey(key.id);
    expect(em.findOne).toHaveBeenCalledWith(
      MemberApiKey,
      { id: key.id },
      {
        populate: ["member.workspace"],
        exclude: ["key"],
        refresh: true,
      },
    );
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(context);
  });

  it("rejects foreign owners even when a misconfigured database returns their keys", async () => {
    const { service, em, authorization } = createService();
    vi.mocked(authorization.assertCurrentUser).mockRestore();
    RequestContext.set(User, createTestUser());
    const foreignUser = Object.assign(createTestUser(), { id: "foreign-user" });
    const foreignWorkspace = Object.assign(createTestWorkspace(), {
      id: "foreign-workspace",
    });
    for (const owner of [foreignUser, foreignWorkspace]) {
      const key = Object.assign(
        owner instanceof User ? new UserApiKey() : new MemberApiKey(),
        {
          user: owner instanceof User ? ref(User, owner) : null,
          member:
            owner instanceof Workspace
              ? ref(
                  Member,
                  Object.assign(createTestMember(), {
                    workspace: ref(Workspace, owner),
                  }),
                )
              : null,
        },
      );
      em.findOne.mockResolvedValue(key);
      const update =
        owner instanceof User
          ? () => service.updateUserApiKey(key.id, { name: "Denied" })
          : () => service.updateMemberApiKey(key.id, { name: "Denied" });
      const remove =
        owner instanceof User
          ? () => service.deleteUserApiKey(key.id)
          : () => service.deleteMemberApiKey(key.id);
      await expect(update()).rejects.toBeInstanceOf(ForbiddenException);
      await expect(remove()).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(em.flush).not.toHaveBeenCalled();
    expect(em.remove).not.toHaveBeenCalled();
  });

  it("paginates user and member keys in the authorized ORM context", async () => {
    const { service, em, authorization } = createService();
    vi.spyOn(RequestIdentity, "assertCurrentWorkspace");
    const user = createTestUser();
    const workspace = createTestWorkspace();
    const args = { first: 10, after: "cursor" };
    const result = {
      edges: [] as { cursor: string; node: object }[],
      pageInfo: {},
    };
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue(result as never);
    const session = mockRlsContext(em);
    await expect(service.getUserApiKeyConnection(user, args)).resolves.toEqual({
      ...result,
      edges: result.edges.map((edge) => ({
        ...edge,
        node: omitCredentials(edge.node, [
          "key",
          "token",
          "password",
          "accessToken",
          "refreshToken",
          "idToken",
        ]),
      })),
    });
    expect(find).toHaveBeenLastCalledWith(UserApiKeyConnection, args, {
      where: { user: user },
      exclude: ["key"],
    });
    await expect(
      service.getMemberApiKeyConnection(workspace, args),
    ).resolves.toEqual({
      ...result,
      edges: result.edges.map((edge) => ({
        ...edge,
        node: omitCredentials(edge.node, [
          "key",
          "token",
          "password",
          "accessToken",
          "refreshToken",
          "idToken",
        ]),
      })),
    });
    expect(find).toHaveBeenLastCalledWith(MemberApiKeyConnection, args, {
      where: { member: { workspace } },
      populate: ["member.workspace"],
      exclude: ["key"],
    });
    expect(find.mock.instances[0]).toHaveProperty("em", em);
    expect(authorization.assertCurrentUser).toHaveBeenCalledWith(user);
    expect(authorization.authorize).toHaveBeenCalledWith("read", UserApiKey);
    expect(authorization.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
    expect(authorization.authorize).toHaveBeenCalledWith("read", MemberApiKey);
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
  });

  it("rejects API-key pagination before creating a connection query", async () => {
    const { service, authorization } = createService();
    const find = vi.spyOn(ConnectionManager.prototype, "find");
    vi.mocked(authorization.authorize).mockImplementation(() => {
      throw new ForbiddenException();
    });
    vi.mocked(authorization.authorize).mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      service.getUserApiKeyConnection(createTestUser(), { first: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getMemberApiKeyConnection(createTestWorkspace(), {
        first: 10,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(find).not.toHaveBeenCalled();
  });

  it("rejects personal key connections for another user before querying", async () => {
    const { service, authorization } = createService();
    vi.mocked(authorization.assertCurrentUser).mockRestore();
    RequestContext.set(User, createTestUser());
    const otherUser = Object.assign(createTestUser(), { id: "user-2" });
    const find = vi.spyOn(ConnectionManager.prototype, "find");

    await expect(
      service.getUserApiKeyConnection(otherUser, { first: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(find).not.toHaveBeenCalled();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("creates a prefixed key and stores only its SHA-256 hash", async () => {
    vi.stubEnv("API_KEY_PREFIX", "nb-");
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const member = RequestContext.get(Member);
    if (!member) throw new Error("Missing test member");
    member.workspace = workspace as never;

    const result = await service.createMemberApiKey(workspace, {
      member: RequestContext.get(Member),
      name: "Deploy key",
    });

    expect(result.apiKey).toMatch(/^nb-[A-Za-z0-9_-]{64}$/);
    expect(em.create).toHaveBeenCalledWith(
      MemberApiKey,
      expect.objectContaining({
        enabled: true,
        key: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        name: "Deploy key",
        permissions: [],
        prefix: "nb-",
        start: result.apiKey.slice(0, 8),
        member: member,
      }),
    );
    expect(JSON.stringify(result.entity)).not.toContain(result.apiKey);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("allows both key scopes to carry member invitation management", async () => {
    const { em, service } = createService();
    await service.createMemberApiKey(createTestWorkspace(), {
      member: RequestContext.get(Member),
      name: "Invitation manager",
      permissions: ["member:invite"],
    });
    expect(em.create).toHaveBeenCalledWith(
      MemberApiKey,
      expect.objectContaining({ permissions: ["member:invite"] }),
    );
    const existing = createTestApiKey();
    em.findOne.mockResolvedValue(existing);
    await service.updateMemberApiKey(existing.id, {
      permissions: ["member:invite"],
    });
    expect(existing.permissions).toEqual(["member:invite"]);
    await service.createUserApiKey(createTestUser(), {
      name: "Human inviter",
      permissions: ["member:invite"],
    });
    expect(em.create).toHaveBeenCalledWith(
      UserApiKey,
      expect.objectContaining({ permissions: ["member:invite"] }),
    );
  });

  it("stores workspace permissions as string values", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const permissions = ["workspace:update"];

    await service.createMemberApiKey(workspace, {
      member: RequestContext.get(Member),
      name: "Deploy key",
      permissions,
    });

    expect(em.create).toHaveBeenCalledWith(
      MemberApiKey,
      expect.objectContaining({ permissions }),
    );
  });

  it("uses independent scope defaults only when creation omits permissions", async () => {
    const { em, service } = createService({
      apiKey: {
        user: {
          defaultPermissions: ["user:read"],
        },
        member: {
          defaultPermissions: ["workspace:update"],
        },
      },
    });
    const workspace = createTestWorkspace();

    await service.createMemberApiKey(workspace, {
      member: RequestContext.get(Member),
      name: "Default permissions",
    });
    await service.createMemberApiKey(workspace, {
      member: RequestContext.get(Member),
      name: "Explicitly empty permissions",
      permissions: null,
    });
    await service.createUserApiKey(
      Object.assign(createTestUser(), { permissions: ["user:read"] }),
      {
        name: "Independent defaults for user keys",
      },
    );

    expect(em.create).toHaveBeenNthCalledWith(
      1,
      MemberApiKey,
      expect.objectContaining({ permissions: ["workspace:update"] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      2,
      MemberApiKey,
      expect.objectContaining({ permissions: [] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      3,
      UserApiKey,
      expect.objectContaining({ permissions: ["user:read"] }),
    );
  });

  it("preserves mixed-case grants when creating and updating either key type", async () => {
    const { em, service } = createService({
      user: { permissions: ["User:READ", "user:read"], roles: { user: [] } },
      workspace: {
        permissions: ["Workspace:UPDATE", "workspace:update"],
        roles: { owner: ["Workspace:UPDATE", "workspace:update"] },
      },
      apiKey: {
        user: {
          allowedPermissions: [
            "User:READ",
            "user:read",
            "Workspace:UPDATE",
            "workspace:update",
          ],
        },
        member: {
          allowedPermissions: [
            "User:READ",
            "user:read",
            "Workspace:UPDATE",
            "workspace:update",
          ],
        },
      },
    });
    const user = Object.assign(createTestUser(), {
      permissions: ["User:READ"],
    });
    const personal = await service.createUserApiKey(user, {
      name: "Personal key",
      permissions: ["User:READ"],
    });
    expect(personal.entity.permissions).toEqual(["User:READ"]);
    em.findOne.mockResolvedValue(personal.entity);
    await service.updateUserApiKey(personal.entity.id, {
      permissions: ["User:READ"],
    });
    await expect(
      service.updateUserApiKey(personal.entity.id, {
        permissions: ["user:read"],
      }),
    ).rejects.toThrow(
      "User API key permissions exceed owner permissions: user:read",
    );
    const workspace = await service.createMemberApiKey(createTestWorkspace(), {
      member: RequestContext.get(Member),
      name: "Workspace key",
      permissions: ["Workspace:UPDATE"],
    });
    expect(workspace.entity.permissions).toEqual(["Workspace:UPDATE"]);
    em.findOne.mockResolvedValue(workspace.entity);
    await service.updateMemberApiKey(workspace.entity.id, {
      permissions: ["workspace:update"],
    });
    expect(workspace.entity.permissions).toEqual(["workspace:update"]);
    await expect(
      service.updateMemberApiKey(workspace.entity.id, {
        permissions: ["Workspace:update"],
      }),
    ).rejects.toThrow("contains unknown permissions: Workspace:update");
  });

  it("enforces the configured API-key permission allowlist", async () => {
    const { em, service } = createService({
      apiKey: {
        user: {
          allowedPermissions: ["workspace:update"],
        },
        member: {
          allowedPermissions: ["workspace:update"],
        },
      },
    });
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), { roles: ["admin"] });

    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Allowed workspace key",
        permissions: ["workspace:update"],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Disallowed workspace key",
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow(
      "API key permissions exceed configured allowedPermissions: workspace:delete",
    );
    await expect(
      service.createUserApiKey(user, {
        name: "Disallowed user key",
        permissions: ["user:read"],
      }),
    ).rejects.toThrow(
      "API key permissions exceed configured allowedPermissions: user:read",
    );
    expect(em.create).toHaveBeenCalledOnce();
  });

  it("creates, reads, updates, and deletes keys owned by the current user", async () => {
    const { em, service } = createService();
    const user = createTestUser();
    user.permissions = ["user:read"];
    const created = await service.createUserApiKey(user, {
      name: "Personal automation",
      permissions: ["user:read", "workspace:update"],
    });

    expect(em.create).toHaveBeenCalledWith(
      UserApiKey,
      expect.objectContaining({ user: user }),
    );

    em.findOne.mockResolvedValue(created.entity);
    expect(await service.getUserApiKey(created.entity.id, user)).toEqual(
      omitCredentials(created.entity, ["key"]),
    );
    expect(
      await service.updateUserApiKey(created.entity.id, { name: "Renamed" }),
    ).toEqual(omitCredentials(created.entity, ["key"]));
    expect(await service.deleteUserApiKey(created.entity.id)).toEqual(
      omitCredentials(created.entity, ["key"]),
    );
  });

  it("allows user keys to combine configured user and workspace permissions", async () => {
    const { em, service } = createService();
    const permissions = ["user:read", "workspace:update"];
    const user = createTestUser();
    user.permissions = ["user:read"];

    await service.createUserApiKey(user, {
      name: "Cross-scope automation",
      permissions,
    });

    expect(em.create).toHaveBeenCalledWith(
      UserApiKey,
      expect.objectContaining({ permissions }),
    );
  });

  it("validates API-key permissions according to the owner type", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();

    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Invalid workspace key",
        permissions: ["user:read"],
      }),
    ).rejects.toThrow("Member API key contains unknown permissions: user:read");
    await expect(
      service.createUserApiKey(createTestUser(), {
        name: "Invalid user key",
        permissions: ["unknown:execute"],
      }),
    ).rejects.toThrow(
      "User API key contains unknown permissions: unknown:execute",
    );
    expect(em.create).not.toHaveBeenCalled();
  });

  it("extends configured permission catalogs without removing the defaults", async () => {
    const { em, service } = createService({
      user: {
        permissions: ["project:read"],
        roles: { user: [], admin: ["project:read"] },
      },
      workspace: {
        permissions: ["deployment:run"],
        roles: { member: [], owner: ["deployment:run"] },
      },
    });
    const workspace = createTestWorkspace();
    const user = createTestUser();
    user.permissions = ["project:read"];

    await service.createMemberApiKey(workspace, {
      member: RequestContext.get(Member),
      name: "Deployment key",
      permissions: ["deployment:run"],
    });
    await service.createUserApiKey(user, {
      name: "Project deployment key",
      permissions: ["project:read", "deployment:run"],
    });
    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Built-in permission key",
        permissions: ["workspace:update"],
      }),
    ).resolves.toBeDefined();

    expect(em.create).toHaveBeenCalledTimes(3);
  });

  it("prevents user keys from exceeding the owner's user permissions", async () => {
    const { em, service } = createService();
    const user = createTestUser();

    await expect(
      service.createUserApiKey(user, {
        name: "Workspace automation",
        permissions: ["workspace:update"],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createUserApiKey(user, {
        name: "Escalated user key",
        permissions: ["user:read"],
      }),
    ).rejects.toThrow(
      "User API key permissions exceed owner permissions: user:read",
    );

    user.roles = ["admin"];
    await expect(
      service.createUserApiKey(user, {
        name: "Administrator key",
        permissions: ["user:read"],
      }),
    ).resolves.toBeDefined();
    expect(em.create).toHaveBeenCalledTimes(2);
  });

  it("prevents member keys from exceeding their owning member's permissions", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const member = RequestContext.get(Member);
    if (!member) throw new Error("Missing test member");
    member.roles = ["admin"];

    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Escalated workspace key",
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow(
      "Member API key permissions exceed owner permissions: workspace:delete",
    );

    member.permissions = ["workspace:delete"];
    RequestIdentity.stage({ member });
    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Direct permission key",
        permissions: ["workspace:delete"],
      }),
    ).resolves.toBeDefined();
    expect(em.create).toHaveBeenCalledOnce();
  });

  it("validates updated API-key permissions according to the owner type", async () => {
    const { em, service } = createService();
    const memberKey = createTestApiKey();
    em.findOne.mockResolvedValue(memberKey);

    await expect(
      service.updateMemberApiKey(memberKey.id, {
        permissions: ["user:read"],
      }),
    ).rejects.toThrow("Member API key contains unknown permissions: user:read");

    const user = createTestUser();
    const userKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, user),
    });
    em.findOne.mockResolvedValue(userKey);
    expect(
      await service.updateUserApiKey(userKey.id, {
        permissions: ["workspace:update"],
      }),
    ).toEqual(omitCredentials(userKey, ["key"]));
    expect(userKey.permissions).toEqual(["workspace:update"]);
  });

  it("enforces owner permission ceilings when API-key permissions are updated", async () => {
    const { em, service } = createService();
    const member = RequestContext.get(Member);
    if (!member) throw new Error("Missing test member");
    member.roles = ["admin"];
    const memberKey = createTestApiKey();
    em.findOne.mockResolvedValue(memberKey);

    await expect(
      service.updateMemberApiKey(memberKey.id, {
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow(
      "Workspace permissions exceed issuer permissions: workspace:delete",
    );
    expect(memberKey.permissions).toEqual([]);

    const user = createTestUser();
    const userKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, user),
    });
    em.findOne.mockResolvedValue(userKey);
    await expect(
      service.updateUserApiKey(userKey.id, {
        permissions: ["user:read"],
      }),
    ).rejects.toThrow(
      "User API key permissions exceed owner permissions: user:read",
    );
    expect(userKey.permissions).toEqual([]);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("preserves omitted permissions and clears explicit null on update", async () => {
    const { em, service } = createService();
    const apiKey = Object.assign(createTestApiKey(), {
      permissions: ["workspace:update"],
    });
    em.findOne.mockResolvedValue(apiKey);

    await service.updateMemberApiKey(apiKey.id, {
      name: "Renamed",
    });
    expect(apiKey.permissions).toEqual(["workspace:update"]);

    await service.updateMemberApiKey(apiKey.id, {
      permissions: null,
    });
    expect(apiKey.permissions).toEqual([]);
  });

  it("prevents user API keys from delegating permissions they do not have", async () => {
    const { em, service } = createService();
    const user = Object.assign(createTestUser(), { roles: ["admin"] });
    const targetKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, user),
      permissions: ["user:read"],
    });
    em.findOne.mockResolvedValue(targetKey);
    const authenticatingKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, user),
      permissions: ["user:read"],
    });

    await RequestContext.child(async () => {
      RequestContext.set(API_KEY, authenticatingKey);

      await expect(
        service.createUserApiKey(user, {
          name: "Escalated delegated key",
          permissions: ["user:delete"],
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: user:delete",
      );
      await expect(
        service.updateUserApiKey(targetKey.id, {
          permissions: ["user:delete"],
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: user:delete",
      );
      targetKey.permissions = ["user:delete"];
      await expect(
        service.updateUserApiKey(targetKey.id, { enabled: false }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: user:delete",
      );
      await expect(
        service.updateUserApiKey(targetKey.id, {
          name: "Still escalated",
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: user:delete",
      );
      targetKey.permissions = [];
      await expect(
        service.createUserApiKey(user, {
          name: "Allowed delegated key",
          permissions: ["user:read"],
        }),
      ).resolves.toBeDefined();
    });
  });

  it("prevents user API keys from escalating delegated member keys", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const targetKey = Object.assign(createTestApiKey(), {
      permissions: ["workspace:update"],
    });
    em.findOne.mockResolvedValue(targetKey);
    const authenticatingKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, createTestUser()),
      permissions: ["workspace:update"],
    });

    await RequestContext.child(async () => {
      RequestContext.set(API_KEY, authenticatingKey);

      await expect(
        service.createMemberApiKey(workspace, {
          member: RequestContext.get(Member),
          name: "Escalated workspace key",
          permissions: ["workspace:delete"],
        }),
      ).rejects.toThrow(
        "Workspace permissions exceed issuer permissions: workspace:delete",
      );
      await expect(
        service.updateMemberApiKey(targetKey.id, {
          permissions: ["workspace:delete"],
        }),
      ).rejects.toThrow(
        "Workspace permissions exceed issuer permissions: workspace:delete",
      );
      targetKey.permissions = ["workspace:delete"];
      await expect(
        service.updateMemberApiKey(targetKey.id, { enabled: false }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: workspace:delete",
      );
      await expect(
        service.updateMemberApiKey(targetKey.id, {
          enabled: true,
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: workspace:delete",
      );
      targetKey.permissions = [];
      await expect(
        service.createMemberApiKey(workspace, {
          member: RequestContext.get(Member),
          name: "Allowed workspace key",
          permissions: ["workspace:update"],
        }),
      ).resolves.toBeDefined();
    });
  });

  it("does not let one user manage another user's key", async () => {
    const { em, service } = createService();
    const apiKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: createTestUser(),
    });
    em.findOne.mockResolvedValue(apiKey);
    const otherUser = Object.assign(createTestUser(), { id: "user-2" });

    await expect(
      service.getUserApiKey(apiKey.id, otherUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows service account members to manage keys within their permissions", async () => {
    const { em, service, authorization } = createService();
    const workspace = createTestWorkspace();
    const target = Object.assign(createTestApiKey(), {
      permissions: ["workspace:update"],
    });
    em.findOne.mockResolvedValue(target);
    const account = Object.assign(createTestMember(), {
      type: MemberType.SERVICE_ACCOUNT,
      user: null,
    });
    RequestContext.set(User, null);
    RequestContext.set(Member, account);
    RequestContext.set(
      API_KEY,
      Object.assign(createTestApiKey(), {
        member: ref(Member, account),
        permissions: ["workspace:update"],
      }),
    );

    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue({ edges: [], pageInfo: {} } as never);
    await service.getMemberApiKeyConnection(workspace, { first: 10 });
    expect(find).toHaveBeenCalledWith(
      MemberApiKeyConnection,
      { first: 10 },
      {
        where: {
          member: { workspace },
          permissions: { $contained: ["workspace:update"], $ne: [] },
        },
        populate: ["member.workspace"],
        exclude: ["key"],
      },
    );
    expect(await service.getMemberApiKey(target.id, workspace)).toEqual(
      omitCredentials(target, ["key"]),
    );
    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Bounded",
        permissions: ["workspace:update"],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Excessive",
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(
      await service.updateMemberApiKey(target.id, {
        permissions: ["workspace:update"],
      }),
    ).toEqual(omitCredentials(target, ["key"]));
    expect(await service.deleteMemberApiKey(target.id)).toEqual(
      omitCredentials(target, ["key"]),
    );
    expect(authorization.assertCurrentMember).toHaveBeenCalledWith(account);
  });

  it("denies member-key access outside the selected workspace or permission ceiling", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const currentKey = Object.assign(createTestApiKey(), {
      permissions: ["workspace:read"],
    });
    RequestContext.set(API_KEY, currentKey);
    const target = Object.assign(createTestApiKey(), {
      permissions: ["workspace:delete"],
    });
    em.findOne.mockResolvedValue(target);
    await expect(service.getMemberApiKey(target.id, workspace)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.updateMemberApiKey(target.id, { permissions: [] }),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.deleteMemberApiKey(target.id)).rejects.toThrow(
      ForbiddenException,
    );
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue({ edges: [], pageInfo: {} } as never);
    await service.getMemberApiKeyConnection(workspace, { first: 10 });
    expect(find).toHaveBeenCalledWith(
      MemberApiKeyConnection,
      { first: 10 },
      {
        where: {
          member: { workspace },
          permissions: { $contained: ["workspace:read"], $ne: [] },
        },
        populate: ["member.workspace"],
        exclude: ["key"],
      },
    );

    const otherWorkspace = Object.assign(createTestWorkspace(), {
      id: "workspace-2",
    });
    find.mockClear();
    await expect(
      service.getMemberApiKeyConnection(otherWorkspace, { first: 10 }),
    ).rejects.toThrow(ForbiddenException);
    expect(find).not.toHaveBeenCalled();
    RequestContext.set(Workspace, otherWorkspace);
    await expect(
      service.createMemberApiKey(otherWorkspace, {
        member: RequestContext.get(Member),
        name: "Wrong owner",
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(em.remove).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("filters personal key connections at the database permission boundary", async () => {
    const { service } = createService();
    const user = createTestUser();
    RequestContext.set(
      API_KEY,
      Object.assign(new UserApiKey(), {
        workspace: null,
        user: user,
        permissions: ["user:read"],
      }),
    );
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue({ edges: [], pageInfo: {} } as never);
    await service.getUserApiKeyConnection(user, { first: 10 });
    expect(find).toHaveBeenCalledWith(
      UserApiKeyConnection,
      { first: 10 },
      {
        where: {
          user: user,
          permissions: { $contained: ["user:read"], $ne: [] },
        },
        exclude: ["key"],
      },
    );
  });

  it("prevents authenticating keys from reading, downgrading, or deleting broader keys", async () => {
    const { em, service } = createService();
    const user = Object.assign(createTestUser(), { roles: ["admin"] });
    const target = Object.assign(new UserApiKey(), {
      workspace: null,
      user: user,
      permissions: ["user:delete"],
    });
    em.findOne.mockResolvedValue(target);

    await RequestContext.child(async () => {
      RequestContext.set(
        API_KEY,
        Object.assign(new UserApiKey(), {
          workspace: null,
          user: user,
          permissions: ["user:read"],
        }),
      );
      await expect(service.getUserApiKey(target.id, user)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.updateUserApiKey(target.id, { permissions: [] }),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.deleteUserApiKey(target.id)).rejects.toThrow(
        ForbiddenException,
      );
      expect(em.remove).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
      expect(target.permissions).toEqual(["user:delete"]);
    });
  });

  it("rejects invalid prefixes and permission values", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();

    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Invalid prefix",
        prefix: "",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Whitespace prefix",
        prefix: "bad prefix-",
      }),
    ).rejects.toThrow(
      "API key prefix must contain 1–32 lowercase letters, digits, underscores, or hyphens and start with a lowercase letter",
    );
    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Invalid permissions",
        permissions: [""],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("rejects invalid prefix characters, length, and initial characters", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    for (const prefix of [
      "",
      "1a",
      "ABC",
      "aB",
      "-sk",
      "_sk",
      "a.b",
      "a b",
      " a",
      "a\n",
      "a\r",
      "a\u0000",
      "a\u007f",
      "é",
      "a😀",
      "a".repeat(33),
    ]) {
      await expect(
        service.createMemberApiKey(workspace, {
          member: RequestContext.get(Member),
          name: "Invalid",
          prefix,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createUserApiKey(user, { name: "Invalid", prefix }),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Environment variables cannot contain NUL (Node truncates at that byte).
      if (!prefix.includes("\u0000")) {
        vi.stubEnv("API_KEY_PREFIX", prefix);
        await expect(
          service.createUserApiKey(user, {
            name: "Invalid environment prefix",
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    }
    expect(em.create).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("isolates configured prefixes and lets explicit prefixes override defaults", async () => {
    vi.stubEnv("API_KEY_PREFIX", "shared_");
    const { service } = createService({
      apiKey: {
        user: { defaultPrefix: "personal_" },
        member: { defaultPrefix: "team_" },
      },
    });
    const userKey = await service.createUserApiKey(createTestUser(), {
      name: "User",
    });
    const memberKey = await service.createMemberApiKey(createTestWorkspace(), {
      member: RequestContext.get(Member),
      name: "Workspace",
    });
    expect(userKey.apiKey).toMatch(/^personal_[A-Za-z0-9_-]{64}$/u);
    expect(userKey.entity.prefix).toBe("personal_");
    expect(memberKey.apiKey).toMatch(/^team_[A-Za-z0-9_-]{64}$/u);
    expect(memberKey.entity.prefix).toBe("team_");
    for (const created of [
      await service.createUserApiKey(createTestUser(), {
        name: "Explicit",
        prefix: "custom_",
      }),
      await service.createMemberApiKey(createTestWorkspace(), {
        member: RequestContext.get(Member),
        name: "Explicit",
        prefix: "custom_",
      }),
    ]) {
      expect(created.apiKey).toMatch(/^custom_[A-Za-z0-9_-]{64}$/u);
      expect(created.entity.prefix).toBe("custom_");
    }
    const { service: fallback } = createService({
      apiKey: { user: { defaultPrefix: "personal_" } },
    });
    expect(
      (
        await fallback.createMemberApiKey(createTestWorkspace(), {
          member: RequestContext.get(Member),
          name: "Fallback",
        })
      ).entity.prefix,
    ).toBe("shared_");
  });

  it("rejects invalid configured prefixes before persistence", async () => {
    const { service, em } = createService({
      apiKey: {
        user: { defaultPrefix: "_invalid" },
        member: { defaultPrefix: "invalid prefix" },
      },
    });
    await expect(
      service.createUserApiKey(createTestUser(), { name: "Invalid" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createMemberApiKey(createTestWorkspace(), {
        member: RequestContext.get(Member),
        name: "Invalid",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("accepts valid prefix boundaries and uses owner-specific defaults", async () => {
    vi.stubEnv("API_KEY_PREFIX", undefined);
    const { service } = createService();
    const user = createTestUser();
    const defaultKey = await service.createUserApiKey(user, {
      name: "Default",
    });
    expect(defaultKey.entity.prefix).toBe("user_");
    expect(defaultKey.apiKey).toMatch(/^user_[A-Za-z0-9_-]{64}$/u);
    const memberKey = await service.createMemberApiKey(createTestWorkspace(), {
      member: RequestContext.get(Member),
      name: "Default workspace",
    });
    expect(memberKey.entity.prefix).toBe("ws_");
    expect(memberKey.apiKey).toMatch(/^ws_[A-Za-z0-9_-]{64}$/u);
    for (const prefix of [
      "sk",
      "sk-",
      "a",
      "abc123-",
      "user_",
      "ws_",
      "a-b",
      "a".repeat(32),
      `${"a".repeat(31)}-`,
    ]) {
      const created = await service.createUserApiKey(user, {
        name: "Valid",
        prefix,
      });
      expect(created.entity.prefix).toBe(prefix);
      expect(created.apiKey.slice(0, prefix.length)).toBe(prefix);
      expect(created.apiKey.slice(prefix.length)).toMatch(
        /^[A-Za-z0-9_-]{64}$/u,
      );
    }
    vi.stubEnv("API_KEY_PREFIX", "invalid prefix");
    await expect(
      service.createUserApiKey(user, {
        name: "Explicit override",
        prefix: "a1",
      }),
    ).resolves.toBeDefined();
  });

  it("rejects inactive members before creating a workspace key", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const member = createTestMember();
    member.status = "DISABLED";
    RequestContext.set(Member, member);

    await expect(
      service.createMemberApiKey(workspace, {
        member: RequestContext.get(Member),
        name: "Deploy key",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("checks workspace permissions instead of hard-coding an owner role", async () => {
    const { authorization, service } = createService();
    const workspace = createTestWorkspace();
    const member = Object.assign(createTestMember(), {
      roles: ["custom-api-key-manager"],
      workspace,
    });
    RequestContext.set(Member, member);

    await service.createMemberApiKey(workspace, {
      member: RequestContext.get(Member),
      name: "Workspace key",
    });
    expect(authorization.assertCurrentMember).toHaveBeenCalledWith(member);
    expect(authorization.authorize).toHaveBeenCalledWith("write", MemberApiKey);
  });

  it("rejects creation from a member of another workspace", async () => {
    const { em, service } = createService();
    const member = Object.assign(createTestMember(), {
      roles: ["owner"],
      workspace: {
        id: "workspace-2",
      } as Member["workspace"],
    });
    RequestContext.set(Member, member);

    await expect(
      service.createMemberApiKey(createTestWorkspace(), {
        member: RequestContext.get(Member),
        name: "Cross key",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("rejects connection queries for a member of another workspace", async () => {
    const { service } = createService();
    const find = vi.spyOn(ConnectionManager.prototype, "find");
    const member = Object.assign(createTestMember(), {
      workspace: {
        id: "workspace-2",
      } as Member["workspace"],
    });
    RequestContext.set(Member, member);

    await expect(
      service.getMemberApiKeyConnection(createTestWorkspace(), {
        first: 10,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(find).not.toHaveBeenCalled();
  });

  it("rejects workspace key access before persistence when permission fails", async () => {
    const { authorization, em, service } = createService();
    const apiKey = createTestApiKey();
    em.findOne.mockResolvedValue(apiKey);
    vi.mocked(authorization.authorize).mockImplementation(() => {
      throw new ForbiddenException();
    });

    await expect(
      service.getMemberApiKey(apiKey.id, createTestWorkspace()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateMemberApiKey(apiKey.id, {
        name: "New",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteMemberApiKey(apiKey.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(em.findOne).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("does not let owners access keys from another workspace", async () => {
    const { em, service } = createService();
    const apiKey = createTestApiKey();
    Reference.unwrapReference(apiKey.member).workspace = ref(
      Workspace,
      Object.assign(createTestWorkspace(), {
        id: "workspace-2",
      }),
    );
    em.findOne.mockResolvedValue(apiKey);
    RequestContext.set(Member, createTestMember());

    await expect(
      service.getMemberApiKey(apiKey.id, createTestWorkspace()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updates and deletes accessible keys", async () => {
    const { em, service } = createService();
    const apiKey = createTestApiKey();
    em.findOne.mockResolvedValue(apiKey);
    const expiresAt = new Date(Date.now() + 60000);
    const permissions = ["workspace:update"];
    expect(
      await service.updateMemberApiKey(apiKey.id, {
        enabled: false,
        expiresAt,
        name: "Renamed",
        permissions,
      }),
    ).toEqual(omitCredentials(apiKey, ["key"]));
    expect(await service.deleteMemberApiKey(apiKey.id)).toEqual(
      omitCredentials(apiKey, ["key"]),
    );

    expect(apiKey.name).toBe("Renamed");
    expect(apiKey.enabled).toBe(false);
    expect(apiKey.expiresAt).toBe(expiresAt);
    expect(apiKey.permissions).toEqual(permissions);
    expect(em.remove).toHaveBeenCalledWith(apiKey);
    expect(em.flush).toHaveBeenCalledTimes(2);
  });
});

function it(name: string, callback: () => void | Promise<void>): void {
  baseIt(name, async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(User, createTestUser());
      RequestContext.set(Workspace, createTestWorkspace());
      RequestContext.set(Member, createTestMember());
      await callback();
    });
  });
}

function createService(
  configuration: Pick<
    AuthModuleOptions,
    "apiKey" | "user" | "workspace" | "buildAbility"
  > = {},
) {
  const em = {
    setSessionContext: vi.fn(),
    getContext: vi.fn().mockReturnThis(),
    getSessionContext:
      vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
    isInTransaction: vi.fn(() => false),
    fork: vi.fn(),
    create: vi.fn((_entity, data) => Object.assign(new _entity(), data)),
    findOne: vi.fn(),
    nativeUpdate: vi.fn().mockResolvedValue(1),
    transactional: vi.fn(),
    flush: vi.fn(),
    persist: vi.fn(),
    remove: vi.fn().mockReturnThis(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);
  em.transactional.mockImplementation(async (callback) => await callback(em));
  const options = {
    ...configuration,
  } as unknown as AuthModuleOptions;
  const authorization = {
    assertCurrentUser: vi
      .spyOn(RequestIdentity, "assertCurrentUser")
      .mockImplementation(vi.fn()),
    assertCurrentMember: vi.spyOn(RequestIdentity, "assertCurrentMember"),
    assertCurrentWorkspace: vi.spyOn(RequestIdentity, "assertCurrentWorkspace"),
    authorize: vi
      .spyOn(abilityHelpers, "authorize")
      .mockImplementation(vi.fn()),
  };
  const userService = new UserApiKeyService(em, options);
  const workspaceService = new MemberApiKeyService(em, options);
  return {
    authorization,
    em,
    service: {
      getUserApiKeyPermissions:
        userService.getUserApiKeyPermissions.bind(userService),
      getMemberApiKeyPermissions:
        workspaceService.getMemberApiKeyPermissions.bind(workspaceService),
      getUserApiKey: userService.getUserApiKey.bind(userService),
      getMemberApiKey: workspaceService.getMemberApiKey.bind(workspaceService),
      getUserApiKeyConnection:
        userService.getUserApiKeyConnection.bind(userService),
      getMemberApiKeyConnection:
        workspaceService.getMemberApiKeyConnection.bind(workspaceService),
      createUserApiKey: userService.createUserApiKey.bind(userService),
      createMemberApiKey:
        workspaceService.createMemberApiKey.bind(workspaceService),
      updateUserApiKey: userService.updateUserApiKey.bind(userService),
      updateMemberApiKey:
        workspaceService.updateMemberApiKey.bind(workspaceService),
      deleteUserApiKey: userService.deleteUserApiKey.bind(userService),
      deleteMemberApiKey:
        workspaceService.deleteMemberApiKey.bind(workspaceService),
    },
  };
}
