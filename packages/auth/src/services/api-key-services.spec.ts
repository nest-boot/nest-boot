/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager, ref } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { it as baseIt, type Mocked } from "vitest";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { API_KEY } from "../auth.constants.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { UserApiKeyConnection } from "../connections/user-api-key.connection-definition.js";
import { WorkspaceApiKeyConnection } from "../connections/workspace-api-key.connection-definition.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import { AccessControlService } from "./access-control.service.js";
import { UserApiKeyService } from "./user-api-key.service.js";
import { WorkspaceApiKeyService } from "./workspace-api-key.service.js";

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
    permissions: [],
    workspace: {
      id: "workspace-1",
    } as Member["workspace"],
  });
}

function createTestApiKey(): WorkspaceApiKey {
  return Object.assign(new WorkspaceApiKey(), {
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
    workspace: ref(Workspace, createTestWorkspace()),
  });
}

describe("API-key management services", () => {
  it("keeps allowlists and default selections isolated between key scopes", async () => {
    const { service } = createService({
      apiKey: {
        user: { allowedPermissions: [], defaultPermissions: [] },
        workspace: {
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
      service.getWorkspaceApiKeyPermissions(createTestWorkspace()),
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
      service.createWorkspaceApiKey(createTestWorkspace(), { name: "Allowed" }),
    ).resolves.toMatchObject({ entity: { permissions: ["workspace:update"] } });
  });
  it("reports configured defaults independently of grantability for both key scopes", () => {
    const { service } = createService({
      apiKey: {
        user: { defaultPermissions: ["workspace:update", "member:delete"] },
        workspace: {
          defaultPermissions: ["workspace:update", "member:delete"],
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
      service.getWorkspaceApiKeyPermissions(createTestWorkspace()),
    ]) {
      expect(options).toContainEqual({
        permission: "workspace:update",
        grantable: true,
        default: true,
      });
      expect(options).toContainEqual({
        permission: "member:delete",
        grantable: false,
        default: true,
      });
      expect(
        options
          .filter((option) => option.default)
          .map((option) => option.permission)
          .sort(),
      ).toEqual(["member:delete", "workspace:update"]);
    }
  });

  it("does not invent defaults when none are configured", () => {
    const { service } = createService();
    expect(service.getUserApiKeyPermissions(createTestUser())).toEqual(
      expect.arrayContaining([expect.objectContaining({ default: false })]),
    );
    expect(
      service
        .getWorkspaceApiKeyPermissions(createTestWorkspace())
        .every((option) => !option.default),
    ).toBe(true);
  });

  it("reports key grantability using both caller ceilings and configuration", () => {
    const { service } = createService({
      apiKey: {
        user: {
          allowedPermissions: [
            "member:update",
            "user:get",
            "user:delete",
            "invitation:create",
          ],
        },
        workspace: {
          allowedPermissions: [
            "member:update",
            "user:get",
            "user:delete",
            "invitation:create",
          ],
        },
      },
    });
    const user = Object.assign(createTestUser(), {
      roles: ["user"],
      permissions: ["user:get"],
    });
    RequestContext.set(User, user);
    RequestContext.set(
      Member,
      Object.assign(createTestMember(), {
        roles: ["member"],
        permissions: ["workspace:update", "member:update"],
      }),
    );
    const workspaceOptions = service.getWorkspaceApiKeyPermissions(
      createTestWorkspace(),
    );
    expect(
      workspaceOptions
        .filter((option) => option.grantable)
        .map((option) => option.permission),
    ).toEqual(["member:update"]);
    expect(workspaceOptions).toContainEqual({
      permission: "invitation:create",
      grantable: false,
      default: false,
    });
    const userOptions = service.getUserApiKeyPermissions(user);
    expect(userOptions).toContainEqual({
      permission: "user:get",
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
      permission: "invitation:create",
      grantable: true,
      default: false,
    });
    RequestIdentity.stage({
      apiKey: Object.assign(new UserApiKey(), {
        user: ref(User, user),
        permissions: ["user:get"],
      }),
    });
    expect(
      service
        .getUserApiKeyPermissions(user)
        .filter((option) => option.grantable)
        .map((option) => option.permission),
    ).toEqual(["user:get"]);
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
    const ability = new WorkspaceAbility();
    RequestContext.set(User, user);
    RequestContext.set(API_KEY, active);
    RequestContext.set(WorkspaceAbility, ability);
    em.findOne.mockResolvedValue(target);
    em.isInTransaction.mockReturnValue(true);
    mockRlsContext(em);
    await service.updateWorkspaceApiKey(target.id, { enabled: false });
    expect(target.lastUsedAt).toBeNull();
    expect(RequestContext.get(API_KEY)).toBe(active);
    expect(RequestContext.get(User)).toBe(user);
    expect(RequestContext.get(WorkspaceAbility)).toBe(ability);
    expect(em.setSessionContext).not.toHaveBeenCalled();
  });

  for (const scope of ["user", "workspace"] as const) {
    it(`checks conditional read restrictions on the loaded ${scope} key`, async () => {
      const options: AuthModuleOptions = {
        user: {
          buildAbility: (rules) => {
            rules.cannot("read", UserApiKey, { enabled: false });
          },
        },
        workspace: {
          buildAbility: (rules) => {
            rules.cannot("read", WorkspaceApiKey, { enabled: false });
          },
        },
      };
      const { service, em, accessControlService } = createService(options);
      vi.mocked(accessControlService.assertUserCan).mockRestore();
      vi.mocked(accessControlService.assertWorkspaceCan).mockRestore();
      const user = Object.assign(createTestUser(), { roles: ["admin"] });
      RequestIdentity.stage({ user });
      RequestIdentity.prepare(options);
      const key = Object.assign(
        scope === "user" ? new UserApiKey() : new WorkspaceApiKey(),
        {
          id: "conditional-key",
          enabled: true,
          permissions: [],
          user: ref(User, user),
          workspace: ref(Workspace, createTestWorkspace()),
        },
      );
      const read = () =>
        scope === "user"
          ? service.getUserApiKey(key.id, user)
          : service.getWorkspaceApiKey(key.id, createTestWorkspace());
      em.findOne.mockResolvedValue(key);
      await expect(read()).resolves.toBe(key);
      key.enabled = false;
      await expect(read()).rejects.toThrow(ForbiddenException);
      em.findOne.mockResolvedValue(null);
      await expect(read()).resolves.toBeNull();
    });

    it(`rejects a ${scope} connection page containing a conditionally denied key without changing pagination`, async () => {
      const options: AuthModuleOptions = {
        user: {
          buildAbility: (rules) => {
            rules.cannot("read", UserApiKey, { enabled: false });
          },
        },
        workspace: {
          buildAbility: (rules) => {
            rules.cannot("read", WorkspaceApiKey, { enabled: false });
          },
        },
      };
      const { service, accessControlService } = createService(options);
      vi.mocked(accessControlService.assertUserCan).mockRestore();
      vi.mocked(accessControlService.assertWorkspaceCan).mockRestore();
      const user = Object.assign(createTestUser(), { roles: ["admin"] });
      RequestIdentity.stage({ user });
      RequestIdentity.prepare(options);
      const key = Object.assign(
        scope === "user" ? new UserApiKey() : new WorkspaceApiKey(),
        { enabled: true },
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
          : service.getWorkspaceApiKeyConnection(createTestWorkspace(), {
              first: 1,
            });
      await expect(read()).resolves.toBe(result);
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
                  user: { allowedPermissions: ["api-key:update"] },
                  workspace: { allowedPermissions: ["api-key:update"] },
                },
              }
            : {};
        const { service, em, accessControlService } = createService(options);
        vi.mocked(accessControlService.assertUserCan).mockRestore();
        vi.mocked(accessControlService.assertWorkspaceCan).mockRestore();
        const user = Object.assign(createTestUser(), {
          roles: [reason === "owner" ? "user" : "admin"],
          permissions: ["api-key:update"],
        });
        const member = Object.assign(createTestMember(), {
          roles: [reason === "owner" ? "member" : "owner"],
          permissions: ["api-key:update"],
        });
        RequestIdentity.stage({ user, member });
        RequestIdentity.prepare(options);
        const permissions = [
          scope === "user" ? "user:get" : "workspace:delete",
        ];
        const key = Object.assign(
          scope === "user" ? new UserApiKey() : new WorkspaceApiKey(),
          {
            id: "stale-key",
            enabled: true,
            permissions,
            user: ref(User, user),
            workspace: ref(Workspace, createTestWorkspace()),
          },
        );
        em.findOne.mockResolvedValue(key);
        const update =
          scope === "user"
            ? service.updateUserApiKey
            : service.updateWorkspaceApiKey;
        await expect(update(key.id, { enabled: false })).resolves.toBe(key);
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
              expiresAt: new Date(Date.now() + 60_000),
            })
          : createTestApiKey();
      const update = (input: { expiresAt?: Date | null; name?: string }) =>
        scope === "user"
          ? service.updateUserApiKey(key.id, input)
          : service.updateWorkspaceApiKey(key.id, input);
      const remove = () =>
        scope === "user"
          ? service.deleteUserApiKey(key.id)
          : service.deleteWorkspaceApiKey(key.id);
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
          : service.createWorkspaceApiKey(createTestWorkspace(), {
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
          scope === "user" ? new UserApiKey() : new WorkspaceApiKey(),
          {
            id: "active-key",
            enabled: true,
            permissions: ["workspace:update"],
            lastUsedAt: new Date(0),
            user: ref(User, user),
            workspace: ref(Workspace, createTestWorkspace()),
          },
        );
        if (scope === "user") RequestContext.set(User, user);
        RequestContext.set(API_KEY, key);
        const ability = new WorkspaceAbility([
          { action: "update", subject: Workspace },
        ]);
        RequestContext.set(WorkspaceAbility, ability);
        em.findOne.mockResolvedValue(key);
        mockRlsContext(em);
        const update =
          scope === "user"
            ? service.updateUserApiKey
            : service.updateWorkspaceApiKey;
        const remove =
          scope === "user"
            ? service.deleteUserApiKey
            : service.deleteWorkspaceApiKey;
        const invoke = () =>
          operation === "delete"
            ? remove(key.id)
            : update(
                key.id,
                operation === "disable"
                  ? { enabled: false }
                  : { permissions: [] },
              );
        em.isInTransaction.mockReturnValueOnce(true);
        await expect(invoke()).rejects.toThrow("outside an active transaction");
        expect(em.flush).not.toHaveBeenCalled();
        em.flush.mockRejectedValueOnce(new Error("Commit failed"));
        await expect(invoke()).rejects.toThrow("Commit failed");
        expect(RequestContext.get(API_KEY)).toBe(key);
        expect(key.enabled).toBe(true);
        expect(key.lastUsedAt).toEqual(new Date(0));
        expect(key.permissions).toEqual(["workspace:update"]);
        expect(RequestContext.get(WorkspaceAbility)).toBe(ability);
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
        expect(
          RequestContext.get(WorkspaceAbility)?.can("update", Workspace),
        ).toBe(false);
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
            },
          });
        }
      });
    }

    for (const action of ["update", "delete"] as const) {
      it(`checks ${scope} ${action} ability against the loaded API key`, async () => {
        const { service, em, accessControlService } = createService();
        const key = Object.assign(
          scope === "user" ? new UserApiKey() : new WorkspaceApiKey(),
          {
            user: scope === "user" ? ref(User, createTestUser()) : null,
            workspace:
              scope === "workspace"
                ? ref(Workspace, createTestWorkspace())
                : null,
          },
        );
        em.findOne.mockResolvedValue(key);
        const assertion =
          scope === "user"
            ? accessControlService.assertUserCan
            : accessControlService.assertWorkspaceCan;
        vi.mocked(assertion).mockImplementation((_action, subject) => {
          if (subject === key) throw new ForbiddenException();
        });

        const operation =
          scope === "user"
            ? action === "update"
              ? () => service.updateUserApiKey(key.id, { name: "Denied" })
              : () => service.deleteUserApiKey(key.id)
            : action === "update"
              ? () => service.updateWorkspaceApiKey(key.id, { name: "Denied" })
              : () => service.deleteWorkspaceApiKey(key.id);

        await expect(operation()).rejects.toBeInstanceOf(ForbiddenException);
        expect(assertion).toHaveBeenCalledWith(
          action,
          scope === "user" ? UserApiKey : WorkspaceApiKey,
        );
        expect(assertion).toHaveBeenLastCalledWith(action, key);
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
    await service.updateWorkspaceApiKey(key.id, { name: "Scoped update" });
    await service.deleteWorkspaceApiKey(key.id);
    expect(em.findOne).toHaveBeenCalledWith(
      WorkspaceApiKey,
      { id: key.id },
      {
        populate: ["workspace"],
        exclude: ["key"],
        refresh: true,
      },
    );
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(context);
  });

  it("rejects foreign owners even when a misconfigured database returns their keys", async () => {
    const { service, em, accessControlService } = createService();
    vi.mocked(accessControlService.assertCurrentUser).mockRestore();
    RequestContext.set(User, createTestUser());
    const foreignUser = Object.assign(createTestUser(), { id: "foreign-user" });
    const foreignWorkspace = Object.assign(createTestWorkspace(), {
      id: "foreign-workspace",
    });
    for (const owner of [foreignUser, foreignWorkspace]) {
      const key = Object.assign(
        owner instanceof User ? new UserApiKey() : new WorkspaceApiKey(),
        {
          user: owner instanceof User ? ref(User, owner) : null,
          workspace: owner instanceof Workspace ? ref(Workspace, owner) : null,
        },
      );
      em.findOne.mockResolvedValue(key);
      const update =
        owner instanceof User
          ? () => service.updateUserApiKey(key.id, { name: "Denied" })
          : () => service.updateWorkspaceApiKey(key.id, { name: "Denied" });
      const remove =
        owner instanceof User
          ? () => service.deleteUserApiKey(key.id)
          : () => service.deleteWorkspaceApiKey(key.id);
      await expect(update()).rejects.toBeInstanceOf(ForbiddenException);
      await expect(remove()).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(em.flush).not.toHaveBeenCalled();
    expect(em.remove).not.toHaveBeenCalled();
  });

  it("paginates user and workspace keys in the authorized ORM context", async () => {
    const { service, em, accessControlService } = createService();
    vi.spyOn(accessControlService, "assertCurrentWorkspace");
    const user = createTestUser();
    const workspace = createTestWorkspace();
    const args = { first: 10, after: "cursor" };
    const result = { edges: [], pageInfo: {} };
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue(result as never);
    const session = mockRlsContext(em);
    await expect(service.getUserApiKeyConnection(user, args)).resolves.toBe(
      result,
    );
    expect(find).toHaveBeenLastCalledWith(UserApiKeyConnection, args, {
      where: { user: user },
      exclude: ["key"],
    });
    await expect(
      service.getWorkspaceApiKeyConnection(workspace, args),
    ).resolves.toBe(result);
    expect(find).toHaveBeenLastCalledWith(WorkspaceApiKeyConnection, args, {
      where: { workspace: workspace },
      exclude: ["key"],
    });
    expect(find.mock.instances[0]).toHaveProperty("em", em);
    expect(accessControlService.assertCurrentUser).toHaveBeenCalledWith(user);
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "read",
      UserApiKey,
    );
    expect(accessControlService.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "read",
      WorkspaceApiKey,
    );
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
  });

  it("rejects API-key pagination before creating a connection query", async () => {
    const { service, accessControlService } = createService();
    const find = vi.spyOn(ConnectionManager.prototype, "find");
    vi.mocked(accessControlService.assertUserCan).mockImplementation(() => {
      throw new ForbiddenException();
    });
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );
    await expect(
      service.getUserApiKeyConnection(createTestUser(), { first: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getWorkspaceApiKeyConnection(createTestWorkspace(), {
        first: 10,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(find).not.toHaveBeenCalled();
  });

  it("rejects personal key connections for another user before querying", async () => {
    const { service, accessControlService } = createService();
    vi.mocked(accessControlService.assertCurrentUser).mockRestore();
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
    vi.stubEnv("API_KEY_PREFIX", "nb");
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const member = RequestContext.get(Member);
    if (!member) throw new Error("Missing test member");
    member.workspace = workspace as never;

    const result = await service.createWorkspaceApiKey(workspace, {
      name: "Deploy key",
    });

    expect(result.apiKey).toMatch(/^nb[A-Za-z0-9_-]{64}$/);
    expect(em.create).toHaveBeenCalledWith(
      WorkspaceApiKey,
      expect.objectContaining({
        enabled: true,
        key: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        name: "Deploy key",
        permissions: [],
        prefix: "nb",
        start: result.apiKey.slice(0, 8),
        workspace: workspace,
      }),
    );
    expect(JSON.stringify(result.entity)).not.toContain(result.apiKey);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("reserves invitation creation for keys with a user identity", async () => {
    const { em, service } = createService();
    await expect(
      service.createWorkspaceApiKey(createTestWorkspace(), {
        name: "No inviter",
        permissions: ["invitation:create"],
      }),
    ).rejects.toThrow("Workspace API keys cannot grant invitation:create");
    expect(em.create).not.toHaveBeenCalled();
    const existing = createTestApiKey();
    em.findOne.mockResolvedValue(existing);
    await expect(
      service.updateWorkspaceApiKey(existing.id, {
        permissions: ["invitation:create"],
      }),
    ).rejects.toThrow("Workspace API keys cannot grant invitation:create");
    expect(em.flush).not.toHaveBeenCalled();
    await service.createUserApiKey(createTestUser(), {
      name: "Human inviter",
      permissions: ["invitation:create"],
    });
    expect(em.create).toHaveBeenCalledWith(
      UserApiKey,
      expect.objectContaining({ permissions: ["invitation:create"] }),
    );
  });

  it("stores workspace permissions as string values", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const permissions = ["workspace:update"];

    await service.createWorkspaceApiKey(workspace, {
      name: "Deploy key",
      permissions,
    });

    expect(em.create).toHaveBeenCalledWith(
      WorkspaceApiKey,
      expect.objectContaining({ permissions }),
    );
  });

  it("uses independent scope defaults only when creation omits permissions", async () => {
    const { em, service } = createService({
      apiKey: {
        user: {
          defaultPermissions: ["user:get"],
        },
        workspace: {
          defaultPermissions: ["workspace:update"],
        },
      },
    });
    const workspace = createTestWorkspace();

    await service.createWorkspaceApiKey(workspace, {
      name: "Default permissions",
    });
    await service.createWorkspaceApiKey(workspace, {
      name: "Explicitly empty permissions",
      permissions: null,
    });
    await service.createUserApiKey(
      Object.assign(createTestUser(), { permissions: ["user:get"] }),
      {
        name: "Independent defaults for user keys",
      },
    );

    expect(em.create).toHaveBeenNthCalledWith(
      1,
      WorkspaceApiKey,
      expect.objectContaining({ permissions: ["workspace:update"] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      2,
      WorkspaceApiKey,
      expect.objectContaining({ permissions: [] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      3,
      UserApiKey,
      expect.objectContaining({ permissions: ["user:get"] }),
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
        workspace: {
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
    const workspace = await service.createWorkspaceApiKey(
      createTestWorkspace(),
      {
        name: "Workspace key",
        permissions: ["Workspace:UPDATE"],
      },
    );
    expect(workspace.entity.permissions).toEqual(["Workspace:UPDATE"]);
    em.findOne.mockResolvedValue(workspace.entity);
    await service.updateWorkspaceApiKey(workspace.entity.id, {
      permissions: ["workspace:update"],
    });
    expect(workspace.entity.permissions).toEqual(["workspace:update"]);
    await expect(
      service.updateWorkspaceApiKey(workspace.entity.id, {
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
        workspace: {
          allowedPermissions: ["workspace:update"],
        },
      },
    });
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), { roles: ["admin"] });

    await expect(
      service.createWorkspaceApiKey(workspace, {
        name: "Allowed workspace key",
        permissions: ["workspace:update"],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createWorkspaceApiKey(workspace, {
        name: "Disallowed workspace key",
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow(
      "API key permissions exceed configured allowedPermissions: workspace:delete",
    );
    await expect(
      service.createUserApiKey(user, {
        name: "Disallowed user key",
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "API key permissions exceed configured allowedPermissions: user:get",
    );
    expect(em.create).toHaveBeenCalledOnce();
  });

  it("creates, reads, updates, and deletes keys owned by the current user", async () => {
    const { em, service } = createService();
    const user = createTestUser();
    user.permissions = ["user:get"];
    const created = await service.createUserApiKey(user, {
      name: "Personal automation",
      permissions: ["user:get", "workspace:update"],
    });

    expect(em.create).toHaveBeenCalledWith(
      UserApiKey,
      expect.objectContaining({ user: user }),
    );

    em.findOne.mockResolvedValue(created.entity);
    await expect(service.getUserApiKey(created.entity.id, user)).resolves.toBe(
      created.entity,
    );
    await expect(
      service.updateUserApiKey(created.entity.id, { name: "Renamed" }),
    ).resolves.toBe(created.entity);
    await expect(service.deleteUserApiKey(created.entity.id)).resolves.toBe(
      created.entity,
    );
  });

  it("allows user keys to combine configured user and workspace permissions", async () => {
    const { em, service } = createService();
    const permissions = ["user:get", "workspace:update"];
    const user = createTestUser();
    user.permissions = ["user:get"];

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
      service.createWorkspaceApiKey(workspace, {
        name: "Invalid workspace key",
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "Workspace API key contains unknown permissions: user:get",
    );
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

    await service.createWorkspaceApiKey(workspace, {
      name: "Deployment key",
      permissions: ["deployment:run"],
    });
    await service.createUserApiKey(user, {
      name: "Project deployment key",
      permissions: ["project:read", "deployment:run"],
    });
    await expect(
      service.createWorkspaceApiKey(workspace, {
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
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "User API key permissions exceed owner permissions: user:get",
    );

    user.roles = ["admin"];
    await expect(
      service.createUserApiKey(user, {
        name: "Administrator key",
        permissions: ["user:get"],
      }),
    ).resolves.toBeDefined();
    expect(em.create).toHaveBeenCalledTimes(2);
  });

  it("prevents workspace keys from exceeding the issuing member's permissions", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const member = RequestContext.get(Member);
    if (!member) throw new Error("Missing test member");
    member.roles = ["admin"];

    await expect(
      service.createWorkspaceApiKey(workspace, {
        name: "Escalated workspace key",
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow(
      "Workspace permissions exceed issuer permissions: workspace:delete",
    );

    member.permissions = ["workspace:delete"];
    RequestIdentity.stage({ member });
    await expect(
      service.createWorkspaceApiKey(workspace, {
        name: "Direct permission key",
        permissions: ["workspace:delete"],
      }),
    ).resolves.toBeDefined();
    expect(em.create).toHaveBeenCalledOnce();
  });

  it("validates updated API-key permissions according to the owner type", async () => {
    const { em, service } = createService();
    const workspaceKey = createTestApiKey();
    em.findOne.mockResolvedValue(workspaceKey);

    await expect(
      service.updateWorkspaceApiKey(workspaceKey.id, {
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "Workspace API key contains unknown permissions: user:get",
    );

    const user = createTestUser();
    const userKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, user),
    });
    em.findOne.mockResolvedValue(userKey);
    await expect(
      service.updateUserApiKey(userKey.id, {
        permissions: ["workspace:update"],
      }),
    ).resolves.toBe(userKey);
    expect(userKey.permissions).toEqual(["workspace:update"]);
  });

  it("enforces owner permission ceilings when API-key permissions are updated", async () => {
    const { em, service } = createService();
    const member = RequestContext.get(Member);
    if (!member) throw new Error("Missing test member");
    member.roles = ["admin"];
    const workspaceKey = createTestApiKey();
    em.findOne.mockResolvedValue(workspaceKey);

    await expect(
      service.updateWorkspaceApiKey(workspaceKey.id, {
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow(
      "Workspace permissions exceed issuer permissions: workspace:delete",
    );
    expect(workspaceKey.permissions).toEqual([]);

    const user = createTestUser();
    const userKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, user),
    });
    em.findOne.mockResolvedValue(userKey);
    await expect(
      service.updateUserApiKey(userKey.id, {
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "User API key permissions exceed owner permissions: user:get",
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

    await service.updateWorkspaceApiKey(apiKey.id, {
      name: "Renamed",
    });
    expect(apiKey.permissions).toEqual(["workspace:update"]);

    await service.updateWorkspaceApiKey(apiKey.id, {
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
    });
    em.findOne.mockResolvedValue(targetKey);
    const authenticatingKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, user),
      permissions: ["user:get"],
    });

    await RequestContext.child(async () => {
      RequestContext.set(API_KEY, authenticatingKey);

      await expect(
        service.createUserApiKey(user, {
          name: "Escalated delegated key",
          permissions: ["user:list"],
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: user:list",
      );
      await expect(
        service.updateUserApiKey(targetKey.id, {
          permissions: ["user:list"],
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: user:list",
      );
      targetKey.permissions = ["user:list"];
      await expect(
        service.updateUserApiKey(targetKey.id, { enabled: false }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: user:list",
      );
      await expect(
        service.updateUserApiKey(targetKey.id, {
          name: "Still escalated",
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: user:list",
      );
      targetKey.permissions = [];
      await expect(
        service.createUserApiKey(user, {
          name: "Allowed delegated key",
          permissions: ["user:get"],
        }),
      ).resolves.toBeDefined();
    });
  });

  it("prevents user API keys from escalating delegated workspace keys", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const targetKey = createTestApiKey();
    em.findOne.mockResolvedValue(targetKey);
    const authenticatingKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, createTestUser()),
      permissions: ["workspace:update"],
    });

    await RequestContext.child(async () => {
      RequestContext.set(API_KEY, authenticatingKey);

      await expect(
        service.createWorkspaceApiKey(workspace, {
          name: "Escalated workspace key",
          permissions: ["workspace:delete"],
        }),
      ).rejects.toThrow(
        "Workspace permissions exceed issuer permissions: workspace:delete",
      );
      await expect(
        service.updateWorkspaceApiKey(targetKey.id, {
          permissions: ["workspace:delete"],
        }),
      ).rejects.toThrow(
        "Workspace permissions exceed issuer permissions: workspace:delete",
      );
      targetKey.permissions = ["workspace:delete"];
      await expect(
        service.updateWorkspaceApiKey(targetKey.id, { enabled: false }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: workspace:delete",
      );
      await expect(
        service.updateWorkspaceApiKey(targetKey.id, {
          enabled: true,
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: workspace:delete",
      );
      targetKey.permissions = [];
      await expect(
        service.createWorkspaceApiKey(workspace, {
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

  it("allows workspace service identities to manage bounded keys without a member", async () => {
    const { em, service, accessControlService } = createService();
    const workspace = createTestWorkspace();
    const target = createTestApiKey();
    em.findOne.mockResolvedValue(target);
    RequestContext.set(Member, null);
    RequestContext.set(
      API_KEY,
      Object.assign(createTestApiKey(), {
        permissions: ["workspace:update"],
      }),
    );

    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue({ edges: [], pageInfo: {} } as never);
    await service.getWorkspaceApiKeyConnection(workspace, { first: 10 });
    expect(find).toHaveBeenCalledWith(
      WorkspaceApiKeyConnection,
      { first: 10 },
      {
        where: {
          workspace: workspace,
          permissions: { $contained: ["workspace:update"] },
        },
        exclude: ["key"],
      },
    );
    await expect(
      service.getWorkspaceApiKey(target.id, workspace),
    ).resolves.toBe(target);
    await expect(
      service.createWorkspaceApiKey(workspace, {
        name: "Bounded",
        permissions: ["workspace:update"],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createWorkspaceApiKey(workspace, {
        name: "Excessive",
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.updateWorkspaceApiKey(target.id, {
        permissions: ["workspace:update"],
      }),
    ).resolves.toBe(target);
    await expect(service.deleteWorkspaceApiKey(target.id)).resolves.toBe(
      target,
    );
    expect(accessControlService.assertCurrentMember).not.toHaveBeenCalled();
  });

  it("denies workspace-key access outside the selected workspace or permission ceiling", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const currentKey = createTestApiKey();
    RequestContext.set(Member, null);
    RequestContext.set(API_KEY, currentKey);
    const target = Object.assign(createTestApiKey(), {
      permissions: ["workspace:delete"],
    });
    em.findOne.mockResolvedValue(target);
    await expect(
      service.getWorkspaceApiKey(target.id, workspace),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.updateWorkspaceApiKey(target.id, { permissions: [] }),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.deleteWorkspaceApiKey(target.id)).rejects.toThrow(
      ForbiddenException,
    );
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue({ edges: [], pageInfo: {} } as never);
    await service.getWorkspaceApiKeyConnection(workspace, { first: 10 });
    expect(find).toHaveBeenCalledWith(
      WorkspaceApiKeyConnection,
      { first: 10 },
      {
        where: {
          workspace: workspace,
          permissions: { $contained: [] },
        },
        exclude: ["key"],
      },
    );

    const otherWorkspace = Object.assign(createTestWorkspace(), {
      id: "workspace-2",
    });
    find.mockClear();
    await expect(
      service.getWorkspaceApiKeyConnection(otherWorkspace, { first: 10 }),
    ).rejects.toThrow(ForbiddenException);
    expect(find).not.toHaveBeenCalled();
    RequestContext.set(Workspace, otherWorkspace);
    await expect(
      service.createWorkspaceApiKey(otherWorkspace, { name: "Wrong owner" }),
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
        permissions: ["user:get"],
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
          permissions: { $contained: ["user:get"] },
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
      permissions: ["user:list"],
    });
    em.findOne.mockResolvedValue(target);

    await RequestContext.child(async () => {
      RequestContext.set(
        API_KEY,
        Object.assign(new UserApiKey(), {
          workspace: null,
          user: user,
          permissions: ["user:get"],
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
      expect(target.permissions).toEqual(["user:list"]);
    });
  });

  it("rejects invalid prefixes and permission values", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();

    await expect(
      service.createWorkspaceApiKey(workspace, {
        name: "Invalid prefix",
        prefix: "",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createWorkspaceApiKey(workspace, {
        name: "Whitespace prefix",
        prefix: "bad prefix-",
      }),
    ).rejects.toThrow(
      "API key prefix must contain 1–32 lowercase letters or digits and start with a lowercase letter",
    );
    await expect(
      service.createWorkspaceApiKey(workspace, {
        name: "Invalid permissions",
        permissions: [""],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("rejects every prefix outside lowercase alphanumerics starting with a letter", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    for (const prefix of [
      "",
      "1a",
      "ABC",
      "aB",
      "sk-",
      "sk_",
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
        service.createWorkspaceApiKey(workspace, { name: "Invalid", prefix }),
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

  it("accepts valid prefix boundaries and uses sk by default", async () => {
    vi.stubEnv("API_KEY_PREFIX", undefined);
    const { service } = createService();
    const user = createTestUser();
    const defaultKey = await service.createUserApiKey(user, {
      name: "Default",
    });
    expect(defaultKey.entity.prefix).toBe("sk");
    for (const prefix of ["a", "abc123", "a".repeat(32)]) {
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
    vi.stubEnv("API_KEY_PREFIX", "invalid-");
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
      service.createWorkspaceApiKey(workspace, { name: "Deploy key" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("checks workspace permissions instead of hard-coding an owner role", async () => {
    const { accessControlService, service } = createService();
    const workspace = createTestWorkspace();
    const member = Object.assign(createTestMember(), {
      roles: ["custom-api-key-manager"],
      workspace,
    });
    RequestContext.set(Member, member);

    await service.createWorkspaceApiKey(workspace, {
      name: "Workspace key",
    });

    expect(accessControlService.assertCurrentMember).toHaveBeenCalledWith(
      member,
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "create",
      WorkspaceApiKey,
    );
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
      service.createWorkspaceApiKey(createTestWorkspace(), {
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
      service.getWorkspaceApiKeyConnection(createTestWorkspace(), {
        first: 10,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(find).not.toHaveBeenCalled();
  });

  it("rejects workspace key access before persistence when permission fails", async () => {
    const { accessControlService, em, service } = createService();
    const apiKey = createTestApiKey();
    em.findOne.mockResolvedValue(apiKey);
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );

    await expect(
      service.getWorkspaceApiKey(apiKey.id, createTestWorkspace()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateWorkspaceApiKey(apiKey.id, {
        name: "New",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deleteWorkspaceApiKey(apiKey.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("does not let owners access keys from another workspace", async () => {
    const { em, service } = createService();
    const apiKey = createTestApiKey();
    apiKey.workspace = ref(
      Workspace,
      Object.assign(createTestWorkspace(), {
        id: "workspace-2",
      }),
    );
    em.findOne.mockResolvedValue(apiKey);
    RequestContext.set(Member, createTestMember());

    await expect(
      service.getWorkspaceApiKey(apiKey.id, createTestWorkspace()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updates and deletes accessible keys", async () => {
    const { em, service } = createService();
    const apiKey = createTestApiKey();
    em.findOne.mockResolvedValue(apiKey);

    const expiresAt = new Date(Date.now() + 60_000);
    const permissions = ["workspace:update"];
    await expect(
      service.updateWorkspaceApiKey(apiKey.id, {
        enabled: false,
        expiresAt,
        name: "Renamed",
        permissions,
      }),
    ).resolves.toBe(apiKey);
    await expect(service.deleteWorkspaceApiKey(apiKey.id)).resolves.toBe(
      apiKey,
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
      RequestContext.set(Workspace, createTestWorkspace());
      RequestContext.set(Member, createTestMember());
      await callback();
    });
  });
}

function createService(
  authorization: Pick<AuthModuleOptions, "apiKey" | "user" | "workspace"> = {},
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
    ...authorization,
  } as unknown as AuthModuleOptions;
  const accessControlService = new AccessControlService(options);
  vi.spyOn(accessControlService, "assertCurrentUser").mockImplementation(
    vi.fn(),
  );
  vi.spyOn(accessControlService, "assertCurrentMember");
  vi.spyOn(accessControlService, "assertUserCan").mockImplementation(vi.fn());
  vi.spyOn(accessControlService, "assertWorkspaceCan").mockImplementation(
    vi.fn(),
  );

  const userService = new UserApiKeyService(em, options, accessControlService);
  const workspaceService = new WorkspaceApiKeyService(
    em,
    options,
    accessControlService,
  );
  return {
    accessControlService,
    em,
    service: {
      getUserApiKeyPermissions:
        userService.getUserApiKeyPermissions.bind(userService),
      getWorkspaceApiKeyPermissions:
        workspaceService.getWorkspaceApiKeyPermissions.bind(workspaceService),
      getUserApiKey: userService.getUserApiKey.bind(userService),
      getWorkspaceApiKey:
        workspaceService.getWorkspaceApiKey.bind(workspaceService),
      getUserApiKeyConnection:
        userService.getUserApiKeyConnection.bind(userService),
      getWorkspaceApiKeyConnection:
        workspaceService.getWorkspaceApiKeyConnection.bind(workspaceService),
      createUserApiKey: userService.createUserApiKey.bind(userService),
      createWorkspaceApiKey:
        workspaceService.createWorkspaceApiKey.bind(workspaceService),
      updateUserApiKey: userService.updateUserApiKey.bind(userService),
      updateWorkspaceApiKey:
        workspaceService.updateWorkspaceApiKey.bind(workspaceService),
      deleteUserApiKey: userService.deleteUserApiKey.bind(userService),
      deleteWorkspaceApiKey:
        workspaceService.deleteWorkspaceApiKey.bind(workspaceService),
    },
  };
}
