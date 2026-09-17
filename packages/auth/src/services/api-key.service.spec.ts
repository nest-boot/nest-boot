/* eslint-disable @typescript-eslint/unbound-method */
import { createHash } from "node:crypto";

import { EntityManager, ref } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { it as baseIt, type Mocked } from "vitest";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { ApiKeyConnection } from "../connections/api-key.connection-definition.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { AccessControlService } from "./access-control.service.js";
import { ApiKeyService } from "./api-key.service.js";

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

function createTestApiKey(): ApiKey {
  return Object.assign(new ApiKey(), {
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

describe("ApiKeyService", () => {
  for (const scope of ["user", "workspace"] as const) {
    for (const action of ["update", "delete"] as const) {
      it(`checks ${scope} ${action} ability against the loaded API key`, async () => {
        const { service, em, accessControlService } = createService();
        const key = Object.assign(createTestApiKey(), {
          user: scope === "user" ? ref(User, createTestUser()) : null,
          workspace:
            scope === "workspace"
              ? ref(Workspace, createTestWorkspace())
              : null,
        });
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
        expect(assertion).toHaveBeenCalledWith(action, ApiKey);
        expect(assertion).toHaveBeenLastCalledWith(action, key);
        expect(key.name).toBe("Deploy key");
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
      ApiKey,
      { id: key.id },
      {
        populate: ["user", "workspace"],
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
      const key = Object.assign(createTestApiKey(), {
        user: owner instanceof User ? ref(User, owner) : null,
        workspace: owner instanceof Workspace ? ref(Workspace, owner) : null,
      });
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
    await expect(service.getApiKeyConnectionByUser(user, args)).resolves.toBe(
      result,
    );
    expect(find).toHaveBeenLastCalledWith(ApiKeyConnection, args, {
      where: { user: user },
      exclude: ["key"],
    });
    await expect(
      service.getApiKeyConnectionByWorkspace(workspace, args),
    ).resolves.toBe(result);
    expect(find).toHaveBeenLastCalledWith(ApiKeyConnection, args, {
      where: { workspace: workspace },
      exclude: ["key"],
    });
    expect(find.mock.instances[0]).toHaveProperty("em", em);
    expect(accessControlService.assertCurrentUser).toHaveBeenCalledWith(user);
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "read",
      ApiKey,
    );
    expect(accessControlService.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "read",
      ApiKey,
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
      service.getApiKeyConnectionByUser(createTestUser(), { first: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getApiKeyConnectionByWorkspace(createTestWorkspace(), {
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
      service.getApiKeyConnectionByUser(otherUser, { first: 10 }),
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
      ApiKey,
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

  it("stores workspace permissions as string values", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const permissions = ["workspace:update"];

    await service.createWorkspaceApiKey(workspace, {
      name: "Deploy key",
      permissions,
    });

    expect(em.create).toHaveBeenCalledWith(
      ApiKey,
      expect.objectContaining({ permissions }),
    );
  });

  it("uses configured defaults only when creation omits permissions", async () => {
    const { em, service } = createService({
      apiKey: {
        defaultPermissions: ["workspace:update"],
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
    await service.createUserApiKey(createTestUser(), {
      name: "Shared defaults for user keys",
    });

    expect(em.create).toHaveBeenNthCalledWith(
      1,
      ApiKey,
      expect.objectContaining({ permissions: ["workspace:update"] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      2,
      ApiKey,
      expect.objectContaining({ permissions: [] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      3,
      ApiKey,
      expect.objectContaining({ permissions: ["workspace:update"] }),
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
        allowedPermissions: [
          "User:READ",
          "user:read",
          "Workspace:UPDATE",
          "workspace:update",
        ],
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
        allowedPermissions: ["workspace:update"],
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
      ApiKey,
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
      ApiKey,
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

  it("uses configured permission catalogs instead of the defaults", async () => {
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
        name: "Replaced default key",
        permissions: ["workspace:update"],
      }),
    ).rejects.toThrow(
      "Workspace API key contains unknown permissions: workspace:update",
    );

    expect(em.create).toHaveBeenCalledTimes(2);
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
    const userKey = Object.assign(createTestApiKey(), {
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
    const userKey = Object.assign(createTestApiKey(), {
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
    const targetKey = Object.assign(createTestApiKey(), {
      workspace: null,
      user: ref(User, user),
    });
    em.findOne.mockResolvedValue(targetKey);
    const authenticatingKey = Object.assign(createTestApiKey(), {
      workspace: null,
      user: ref(User, user),
      permissions: ["user:get"],
    });

    await RequestContext.child(async () => {
      RequestContext.set(ApiKey, authenticatingKey);

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
    const authenticatingKey = Object.assign(createTestApiKey(), {
      workspace: null,
      user: ref(User, createTestUser()),
      permissions: ["workspace:update"],
    });

    await RequestContext.child(async () => {
      RequestContext.set(ApiKey, authenticatingKey);

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
    const apiKey = Object.assign(createTestApiKey(), {
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
      ApiKey,
      Object.assign(createTestApiKey(), {
        permissions: ["workspace:update"],
      }),
    );

    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue({ edges: [], pageInfo: {} } as never);
    await service.getApiKeyConnectionByWorkspace(workspace, { first: 10 });
    expect(find).toHaveBeenCalledWith(
      ApiKeyConnection,
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
    RequestContext.set(ApiKey, currentKey);
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
    await service.getApiKeyConnectionByWorkspace(workspace, { first: 10 });
    expect(find).toHaveBeenCalledWith(
      ApiKeyConnection,
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
      service.getApiKeyConnectionByWorkspace(otherWorkspace, { first: 10 }),
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
      ApiKey,
      Object.assign(createTestApiKey(), {
        workspace: null,
        user: user,
        permissions: ["user:get"],
      }),
    );
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue({ edges: [], pageInfo: {} } as never);
    await service.getApiKeyConnectionByUser(user, { first: 10 });
    expect(find).toHaveBeenCalledWith(
      ApiKeyConnection,
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
    const target = Object.assign(createTestApiKey(), {
      workspace: null,
      user: user,
      permissions: ["user:list"],
    });
    em.findOne.mockResolvedValue(target);

    await RequestContext.child(async () => {
      RequestContext.set(
        ApiKey,
        Object.assign(createTestApiKey(), {
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

  it("rejects inactive members and past expiration timestamps", async () => {
    const { em, service } = createService();
    const workspace = createTestWorkspace();
    const member = createTestMember();
    member.status = "DISABLED";
    RequestContext.set(Member, member);

    await expect(
      service.createWorkspaceApiKey(workspace, { name: "Deploy key" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    member.status = "ACTIVE";
    await expect(
      service.createWorkspaceApiKey(workspace, {
        expiresAt: new Date(Date.now() - 1_000),
        name: "Deploy key",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
      ApiKey,
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
      service.getApiKeyConnectionByWorkspace(createTestWorkspace(), {
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

  it("rejects missing, unknown, and expired keys", async () => {
    const { em, service } = createService();

    await expect(service.validate("")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.validate("invalid")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const expired = createTestApiKey();
    expired.expiresAt = new Date(Date.now() - 1_000);
    em.findOne.mockResolvedValueOnce(expired);
    await expect(service.validate("sk-valid-key")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    em.findOne.mockReset();
    em.findOne.mockResolvedValueOnce(null);
    await expect(service.validate("sk-unknown-key")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects disabled keys", async () => {
    const { em, service } = createService();
    const disabled = Object.assign(createTestApiKey(), { enabled: false });
    em.findOne.mockResolvedValueOnce(disabled);

    await expect(service.validate("sk-disabled-key")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects keys for deleted workspaces", async () => {
    const { em, service } = createService();
    const apiKey = createTestApiKey();
    apiKey.workspace = ref(
      Workspace,
      Object.assign(createTestWorkspace(), {
        deletedAt: new Date(),
      }),
    );
    em.findOne.mockResolvedValueOnce(apiKey);
    await expect(
      service.validate("sk-deleted-workspace-key"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects personal keys owned by an actively banned user", async () => {
    const { em, service } = createService();
    const user = Object.assign(createTestUser(), {
      banned: true,
      banExpiresAt: null,
    });
    const apiKey = Object.assign(createTestApiKey(), {
      workspace: null,
      user: ref(User, user),
    });
    em.findOne.mockResolvedValueOnce(apiKey);

    await expect(service.validate("sk-banned-user-key")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("uses its injected manager without changing the infrastructure's RLS context", async () => {
    const { em, service } = createService();
    const apiKey = createTestApiKey();
    const workspace = createTestWorkspace();
    const plaintextApiKey = "sk-valid-key";
    em.findOne.mockImplementation((entity, where) => {
      expect(RequestContext.get(EntityManager)).toBe(em);
      expect(em.getSessionContext()?.role).toBe("authenticated");
      if (entity === ApiKey) {
        expect(where).toEqual({
          key: createHash("sha256").update(plaintextApiKey).digest("base64url"),
        });
      }
      return Promise.resolve(entity === ApiKey ? apiKey : null);
    });

    await RequestContext.child(async () => {
      const sessionContext = mockRlsContext(em);
      RequestContext.set(EntityManager, em as unknown as EntityManager);
      await expect(service.validate(plaintextApiKey)).resolves.toEqual({
        apiKey,
        ownerType: "workspace",
        workspace,
      });
      expect(em.getSessionContext()).toEqual(sessionContext);
      expect(em.fork).not.toHaveBeenCalled();
    });
  });

  it("records successful usage timestamps", async () => {
    const { em, service } = createService();
    const apiKey = createTestApiKey();

    await expect(service.recordUsage(apiKey)).resolves.toBe(apiKey);
    expect(apiKey.lastUsedAt).toBeInstanceOf(Date);
    expect(apiKey.updatedAt).toBe(apiKey.lastUsedAt);
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      ApiKey,
      { id: apiKey.id },
      { lastUsedAt: apiKey.lastUsedAt, updatedAt: apiKey.updatedAt },
    );
    expect(em.flush).not.toHaveBeenCalled();
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
    getContext: vi.fn().mockReturnThis(),
    getSessionContext:
      vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
    isInTransaction: vi.fn(() => false),
    fork: vi.fn(),
    create: vi.fn((_entity, data) => Object.assign(createTestApiKey(), data)),
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

  return {
    accessControlService,
    em,
    service: new ApiKeyService(em, options, accessControlService),
  };
}
