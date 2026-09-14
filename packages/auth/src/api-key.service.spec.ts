/* eslint-disable @typescript-eslint/unbound-method */
import { createHash } from "node:crypto";

import { EntityManager, ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { it as baseIt, type Mocked } from "vitest";

import { mockRlsContext } from "../test/mock-rls-context.js";
import { AccessControlService } from "./access-control.service.js";
import { ApiKeyService } from "./api-key.service.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import {
  BaseApiKey,
  BaseUser,
  BaseWorkspace,
  BaseWorkspaceMember,
} from "./entities/index.js";

class TestWorkspace extends BaseWorkspace {
  override id = "workspace-1";
  override name = "Acme";
}

class TestUser extends BaseUser {
  override id = "user-1";
  override name = "Alice";
  override email = "alice@example.com";
  override emailVerified = true;
}

class TestWorkspaceMember extends BaseWorkspaceMember {
  override id = "member-1";
  override name = "Alice";
  override roles = ["owner"];
  override status: BaseWorkspaceMember["status"] = "ACTIVE";
  override permissions: string[] = [];
  override workspace = {
    id: "workspace-1",
  } as BaseWorkspaceMember["workspace"];
}

class TestApiKey extends BaseApiKey {
  override id = "api-key-1";
  override name = "Deploy key";
  override start = "sk012345";
  override prefix = "sk";
  override key = "hashed-key";
  override enabled = true;
  override permissions: string[] = [];
  override updatedAt = new Date();
  override lastUsedAt: Date | null = null;
  override expiresAt: Date | null = null;
  override owner: BaseApiKey["owner"] = ref(TestWorkspace, new TestWorkspace());
}

describe("ApiKeyService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("creates a prefixed key and stores only its SHA-256 hash", async () => {
    vi.stubEnv("API_KEY_PREFIX", "nb");
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = RequestContext.get(
      BaseWorkspaceMember,
    ) as TestWorkspaceMember;
    member.workspace = workspace as never;

    const result = await service.createWorkspaceKey(workspace, {
      name: "Deploy key",
    });

    expect(result.apiKey).toMatch(/^nb[A-Za-z0-9_-]{64}$/);
    expect(em.create).toHaveBeenCalledWith(
      TestApiKey,
      expect.objectContaining({
        enabled: true,
        key: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        name: "Deploy key",
        permissions: [],
        prefix: "nb",
        start: result.apiKey.slice(0, 8),
        owner: workspace,
      }),
    );
    expect(JSON.stringify(result.entity)).not.toContain(result.apiKey);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("stores workspace permissions as string values", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const permissions = ["Workspace:update"];

    await service.createWorkspaceKey(workspace, {
      name: "Deploy key",
      permissions,
    });

    expect(em.create).toHaveBeenCalledWith(
      TestApiKey,
      expect.objectContaining({ permissions }),
    );
  });

  it("uses configured defaults only when creation omits permissions", async () => {
    const { em, service } = createService({
      apiKey: {
        defaultPermissions: ["Workspace:update"],
      },
    });
    const workspace = new TestWorkspace();

    await service.createWorkspaceKey(workspace, {
      name: "Default permissions",
    });
    await service.createWorkspaceKey(workspace, {
      name: "Explicitly empty permissions",
      permissions: null,
    });
    await service.createUserKey(new TestUser(), {
      name: "Shared defaults for user keys",
    });

    expect(em.create).toHaveBeenNthCalledWith(
      1,
      TestApiKey,
      expect.objectContaining({ permissions: ["Workspace:update"] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      2,
      TestApiKey,
      expect.objectContaining({ permissions: [] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      3,
      TestApiKey,
      expect.objectContaining({ permissions: ["Workspace:update"] }),
    );
  });

  it("enforces the configured API-key permission allowlist", async () => {
    const { em, service } = createService({
      apiKey: {
        allowedPermissions: ["Workspace:update"],
      },
    });
    const workspace = new TestWorkspace();
    const user = Object.assign(new TestUser(), { roles: ["admin"] });

    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Allowed workspace key",
        permissions: ["Workspace:update"],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Disallowed workspace key",
        permissions: ["Workspace:delete"],
      }),
    ).rejects.toThrow(
      "API key permissions exceed configured allowedPermissions: Workspace:delete",
    );
    await expect(
      service.createUserKey(user, {
        name: "Disallowed user key",
        permissions: ["User:get"],
      }),
    ).rejects.toThrow(
      "API key permissions exceed configured allowedPermissions: User:get",
    );
    expect(em.create).toHaveBeenCalledOnce();
  });

  it("creates, lists, updates, and deletes keys owned by the current user", async () => {
    const { em, service } = createService();
    const user = new TestUser();
    user.permissions = ["User:get"];
    const created = await service.createUserKey(user, {
      name: "Personal automation",
      permissions: ["User:get", "Workspace:update"],
    });

    expect(service.getUserListFilter(user)).toEqual({ owner: user });
    expect(em.create).toHaveBeenCalledWith(
      TestApiKey,
      expect.objectContaining({ owner: user }),
    );

    em.findOne.mockResolvedValue(created.entity);
    await expect(service.getUserApiKey(created.entity.id, user)).resolves.toBe(
      created.entity,
    );
    await expect(
      service.updateUserKey(created.entity.id, user, { name: "Renamed" }),
    ).resolves.toBe(created.entity);
    await expect(service.deleteUserKey(created.entity.id, user)).resolves.toBe(
      created.entity,
    );
  });

  it("allows user keys to combine configured user and workspace permissions", async () => {
    const { em, service } = createService();
    const permissions = ["User:get", "Workspace:update"];
    const user = new TestUser();
    user.permissions = ["User:get"];

    await service.createUserKey(user, {
      name: "Cross-scope automation",
      permissions,
    });

    expect(em.create).toHaveBeenCalledWith(
      TestApiKey,
      expect.objectContaining({ permissions }),
    );
  });

  it("validates API-key permissions according to the owner type", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();

    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Invalid workspace key",
        permissions: ["User:get"],
      }),
    ).rejects.toThrow(
      "Workspace API key contains unknown permissions: User:get",
    );
    await expect(
      service.createUserKey(new TestUser(), {
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
    const workspace = new TestWorkspace();
    const user = new TestUser();
    user.permissions = ["project:read"];

    await service.createWorkspaceKey(workspace, {
      name: "Deployment key",
      permissions: ["deployment:run"],
    });
    await service.createUserKey(user, {
      name: "Project deployment key",
      permissions: ["project:read", "deployment:run"],
    });
    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Replaced default key",
        permissions: ["Workspace:update"],
      }),
    ).rejects.toThrow(
      "Workspace API key contains unknown permissions: Workspace:update",
    );

    expect(em.create).toHaveBeenCalledTimes(2);
  });

  it("prevents user keys from exceeding the owner's user permissions", async () => {
    const { em, service } = createService();
    const user = new TestUser();

    await expect(
      service.createUserKey(user, {
        name: "Workspace automation",
        permissions: ["Workspace:update"],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createUserKey(user, {
        name: "Escalated user key",
        permissions: ["User:get"],
      }),
    ).rejects.toThrow(
      "User API key permissions exceed owner permissions: User:get",
    );

    user.roles = ["admin"];
    await expect(
      service.createUserKey(user, {
        name: "Administrator key",
        permissions: ["User:get"],
      }),
    ).resolves.toBeDefined();
    expect(em.create).toHaveBeenCalledTimes(2);
  });

  it("prevents workspace keys from exceeding the issuing member's permissions", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = RequestContext.get(
      BaseWorkspaceMember,
    ) as TestWorkspaceMember;
    member.roles = ["admin"];

    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Escalated workspace key",
        permissions: ["Workspace:delete"],
      }),
    ).rejects.toThrow(
      "Workspace permissions exceed issuer permissions: Workspace:delete",
    );

    member.permissions = ["Workspace:delete"];
    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Direct permission key",
        permissions: ["Workspace:delete"],
      }),
    ).resolves.toBeDefined();
    expect(em.create).toHaveBeenCalledOnce();
  });

  it("validates updated API-key permissions according to the owner type", async () => {
    const { em, service } = createService();
    const workspaceKey = new TestApiKey();
    em.findOne.mockResolvedValue(workspaceKey);

    await expect(
      service.updateWorkspaceKey(workspaceKey.id, new TestWorkspace(), {
        permissions: ["User:get"],
      }),
    ).rejects.toThrow(
      "Workspace API key contains unknown permissions: User:get",
    );

    const user = new TestUser();
    const userKey = Object.assign(new TestApiKey(), {
      owner: ref(TestUser, user),
    });
    em.findOne.mockResolvedValue(userKey);
    await expect(
      service.updateUserKey(userKey.id, user, {
        permissions: ["Workspace:update"],
      }),
    ).resolves.toBe(userKey);
    expect(userKey.permissions).toEqual(["Workspace:update"]);
  });

  it("enforces owner permission ceilings when API-key permissions are updated", async () => {
    const { em, service } = createService();
    const member = RequestContext.get(
      BaseWorkspaceMember,
    ) as TestWorkspaceMember;
    member.roles = ["admin"];
    const workspaceKey = new TestApiKey();
    em.findOne.mockResolvedValue(workspaceKey);

    await expect(
      service.updateWorkspaceKey(workspaceKey.id, new TestWorkspace(), {
        permissions: ["Workspace:delete"],
      }),
    ).rejects.toThrow(
      "Workspace permissions exceed issuer permissions: Workspace:delete",
    );
    expect(workspaceKey.permissions).toEqual([]);

    const user = new TestUser();
    const userKey = Object.assign(new TestApiKey(), {
      owner: ref(TestUser, user),
    });
    em.findOne.mockResolvedValue(userKey);
    await expect(
      service.updateUserKey(userKey.id, user, {
        permissions: ["User:get"],
      }),
    ).rejects.toThrow(
      "User API key permissions exceed owner permissions: User:get",
    );
    expect(userKey.permissions).toEqual([]);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("preserves omitted permissions and clears explicit null on update", async () => {
    const { em, service } = createService();
    const apiKey = Object.assign(new TestApiKey(), {
      permissions: ["Workspace:update"],
    });
    em.findOne.mockResolvedValue(apiKey);

    await service.updateWorkspaceKey(apiKey.id, new TestWorkspace(), {
      name: "Renamed",
    });
    expect(apiKey.permissions).toEqual(["Workspace:update"]);

    await service.updateWorkspaceKey(apiKey.id, new TestWorkspace(), {
      permissions: null,
    });
    expect(apiKey.permissions).toEqual([]);
  });

  it("prevents user API keys from delegating permissions they do not have", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), { roles: ["admin"] });
    const targetKey = Object.assign(new TestApiKey(), {
      owner: ref(TestUser, user),
    });
    em.findOne.mockResolvedValue(targetKey);
    const authenticatingKey = Object.assign(new TestApiKey(), {
      owner: ref(TestUser, user),
      permissions: ["User:get"],
    });

    await RequestContext.child(async () => {
      RequestContext.set(BaseApiKey, authenticatingKey);

      await expect(
        service.createUserKey(user, {
          name: "Escalated delegated key",
          permissions: ["User:list"],
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: User:list",
      );
      await expect(
        service.updateUserKey(targetKey.id, user, {
          permissions: ["User:list"],
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: User:list",
      );
      targetKey.permissions = ["User:list"];
      await expect(
        service.updateUserKey(targetKey.id, user, {
          name: "Still escalated",
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: User:list",
      );
      targetKey.permissions = [];
      await expect(
        service.createUserKey(user, {
          name: "Allowed delegated key",
          permissions: ["User:get"],
        }),
      ).resolves.toBeDefined();
    });
  });

  it("prevents user API keys from escalating delegated workspace keys", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const targetKey = new TestApiKey();
    em.findOne.mockResolvedValue(targetKey);
    const authenticatingKey = Object.assign(new TestApiKey(), {
      owner: ref(TestUser, new TestUser()),
      permissions: ["Workspace:update"],
    });

    await RequestContext.child(async () => {
      RequestContext.set(BaseApiKey, authenticatingKey);

      await expect(
        service.createWorkspaceKey(workspace, {
          name: "Escalated workspace key",
          permissions: ["Workspace:delete"],
        }),
      ).rejects.toThrow(
        "Workspace permissions exceed issuer permissions: Workspace:delete",
      );
      await expect(
        service.updateWorkspaceKey(targetKey.id, new TestWorkspace(), {
          permissions: ["Workspace:delete"],
        }),
      ).rejects.toThrow(
        "Workspace permissions exceed issuer permissions: Workspace:delete",
      );
      targetKey.permissions = ["Workspace:delete"];
      await expect(
        service.updateWorkspaceKey(targetKey.id, new TestWorkspace(), {
          enabled: true,
        }),
      ).rejects.toThrow(
        "API key permissions exceed authenticating API key permissions: Workspace:delete",
      );
      targetKey.permissions = [];
      await expect(
        service.createWorkspaceKey(workspace, {
          name: "Allowed workspace key",
          permissions: ["Workspace:update"],
        }),
      ).resolves.toBeDefined();
    });
  });

  it("does not let one user manage another user's key", async () => {
    const { em, service } = createService();
    const apiKey = Object.assign(new TestApiKey(), {
      owner: new TestUser(),
    });
    em.findOne.mockResolvedValue(apiKey);
    const otherUser = Object.assign(new TestUser(), { id: "user-2" });

    await expect(
      service.getUserApiKey(apiKey.id, otherUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows workspace service identities to manage bounded keys without a member", async () => {
    const { em, service, accessControlService } = createService();
    const workspace = new TestWorkspace();
    const target = new TestApiKey();
    em.findOne.mockResolvedValue(target);
    RequestContext.set(BaseWorkspaceMember, null);
    RequestContext.set(
      BaseApiKey,
      Object.assign(new TestApiKey(), {
        permissions: ["Workspace:update"],
      }),
    );

    expect(service.getWorkspaceListFilter(workspace)).toEqual({
      owner: workspace,
      permissions: { $contained: ["Workspace:update"] },
    });
    await expect(
      service.getWorkspaceApiKey(target.id, workspace),
    ).resolves.toBe(target);
    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Bounded",
        permissions: ["Workspace:update"],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Excessive",
        permissions: ["Workspace:delete"],
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.updateWorkspaceKey(target.id, workspace, {
        permissions: ["Workspace:update"],
      }),
    ).resolves.toBe(target);
    await expect(
      service.deleteWorkspaceKey(target.id, workspace),
    ).resolves.toBe(target);
    expect(
      accessControlService.assertCurrentWorkspaceMember,
    ).not.toHaveBeenCalled();
  });

  it("denies workspace-key access outside the selected workspace or permission ceiling", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const currentKey = new TestApiKey();
    RequestContext.set(BaseWorkspaceMember, null);
    RequestContext.set(BaseApiKey, currentKey);
    const target = Object.assign(new TestApiKey(), {
      permissions: ["Workspace:delete"],
    });
    em.findOne.mockResolvedValue(target);
    await expect(
      service.getWorkspaceApiKey(target.id, workspace),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.updateWorkspaceKey(target.id, workspace, { permissions: [] }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.deleteWorkspaceKey(target.id, workspace),
    ).rejects.toThrow(ForbiddenException);
    expect(service.getWorkspaceListFilter(workspace)).toEqual({
      owner: workspace,
      permissions: { $contained: [] },
    });

    const otherWorkspace = Object.assign(new TestWorkspace(), {
      id: "workspace-2",
    });
    expect(() => service.getWorkspaceListFilter(otherWorkspace)).toThrow(
      ForbiddenException,
    );
    RequestContext.set(BaseWorkspace, otherWorkspace);
    await expect(
      service.createWorkspaceKey(otherWorkspace, { name: "Wrong owner" }),
    ).rejects.toThrow(ForbiddenException);
    expect(em.remove).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("filters personal key lists at the database permission boundary", () => {
    const { service } = createService();
    const user = new TestUser();
    RequestContext.set(
      BaseApiKey,
      Object.assign(new TestApiKey(), {
        owner: user,
        permissions: ["User:get"],
      }),
    );
    expect(service.getUserListFilter(user)).toEqual({
      owner: user,
      permissions: { $contained: ["User:get"] },
    });
  });

  it("prevents authenticating keys from reading, downgrading, or deleting broader keys", async () => {
    const { em, service } = createService();
    const user = Object.assign(new TestUser(), { roles: ["admin"] });
    const target = Object.assign(new TestApiKey(), {
      owner: user,
      permissions: ["User:list"],
    });
    em.findOne.mockResolvedValue(target);

    await RequestContext.child(async () => {
      RequestContext.set(
        BaseApiKey,
        Object.assign(new TestApiKey(), {
          owner: user,
          permissions: ["User:get"],
        }),
      );
      await expect(service.getUserApiKey(target.id, user)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.updateUserKey(target.id, user, { permissions: [] }),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.deleteUserKey(target.id, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(em.remove).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
      expect(target.permissions).toEqual(["User:list"]);
    });
  });

  it("rejects invalid prefixes and permission values", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();

    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Invalid prefix",
        prefix: "",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Whitespace prefix",
        prefix: "bad prefix-",
      }),
    ).rejects.toThrow(
      "API key prefix must contain 1–32 lowercase letters or digits and start with a lowercase letter",
    );
    await expect(
      service.createWorkspaceKey(workspace, {
        name: "Invalid permissions",
        permissions: [""],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("rejects every prefix outside lowercase alphanumerics starting with a letter", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const user = new TestUser();
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
        service.createWorkspaceKey(workspace, { name: "Invalid", prefix }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createUserKey(user, { name: "Invalid", prefix }),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Environment variables cannot contain NUL (Node truncates at that byte).
      if (!prefix.includes("\u0000")) {
        vi.stubEnv("API_KEY_PREFIX", prefix);
        await expect(
          service.createUserKey(user, { name: "Invalid environment prefix" }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    }
    expect(em.create).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("accepts valid prefix boundaries and uses sk by default", async () => {
    vi.stubEnv("API_KEY_PREFIX", undefined);
    const { service } = createService();
    const user = new TestUser();
    const defaultKey = await service.createUserKey(user, { name: "Default" });
    expect(defaultKey.entity.prefix).toBe("sk");
    for (const prefix of ["a", "abc123", "a".repeat(32)]) {
      const created = await service.createUserKey(user, {
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
      service.createUserKey(user, { name: "Explicit override", prefix: "a1" }),
    ).resolves.toBeDefined();
  });

  it("rejects inactive members and past expiration timestamps", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = new TestWorkspaceMember();
    member.status = "DISABLED";
    RequestContext.set(BaseWorkspaceMember, member);

    await expect(
      service.createWorkspaceKey(workspace, { name: "Deploy key" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    member.status = "ACTIVE";
    await expect(
      service.createWorkspaceKey(workspace, {
        expiresAt: new Date(Date.now() - 1_000),
        name: "Deploy key",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("checks workspace permissions instead of hard-coding an owner role", async () => {
    const { accessControlService, service } = createService();
    const workspace = new TestWorkspace();
    const member = Object.assign(new TestWorkspaceMember(), {
      roles: ["custom-api-key-manager"],
      workspace,
    });
    RequestContext.set(BaseWorkspaceMember, member);

    await service.createWorkspaceKey(workspace, {
      name: "Workspace key",
    });

    expect(
      accessControlService.assertCurrentWorkspaceMember,
    ).toHaveBeenCalledWith(member);
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "create",
      TestApiKey,
    );
  });

  it("rejects creation from a member of another workspace", async () => {
    const { em, service } = createService();
    const member = Object.assign(new TestWorkspaceMember(), {
      roles: ["owner"],
      workspace: {
        id: "workspace-2",
      } as BaseWorkspaceMember["workspace"],
    });
    RequestContext.set(BaseWorkspaceMember, member);

    await expect(
      service.createWorkspaceKey(new TestWorkspace(), {
        name: "Cross key",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("checks workspace read permission before building a list filter", () => {
    const { accessControlService, service } = createService();
    const workspace = new TestWorkspace();

    expect(service.getWorkspaceListFilter(workspace)).toEqual({
      owner: workspace,
    });
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "read",
      TestApiKey,
    );
  });

  it("rejects list filters for a member of another workspace", () => {
    const { service } = createService();
    const member = Object.assign(new TestWorkspaceMember(), {
      workspace: {
        id: "workspace-2",
      } as BaseWorkspaceMember["workspace"],
    });
    RequestContext.set(BaseWorkspaceMember, member);

    expect(() => service.getWorkspaceListFilter(new TestWorkspace())).toThrow(
      ForbiddenException,
    );
  });

  it("rejects workspace key access before persistence when permission fails", async () => {
    const { accessControlService, em, service } = createService();
    const apiKey = new TestApiKey();
    em.findOne.mockResolvedValue(apiKey);
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );

    await expect(
      service.getWorkspaceApiKey(apiKey.id, new TestWorkspace()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateWorkspaceKey(apiKey.id, new TestWorkspace(), {
        name: "New",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deleteWorkspaceKey(apiKey.id, new TestWorkspace()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("does not let owners access keys from another workspace", async () => {
    const { em, service } = createService();
    const apiKey = new TestApiKey();
    apiKey.owner = ref(
      TestWorkspace,
      Object.assign(new TestWorkspace(), {
        id: "workspace-2",
      }),
    );
    em.findOne.mockResolvedValue(apiKey);
    RequestContext.set(BaseWorkspaceMember, new TestWorkspaceMember());

    await expect(
      service.getWorkspaceApiKey(apiKey.id, new TestWorkspace()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updates and deletes accessible keys", async () => {
    const { em, service } = createService();
    const apiKey = new TestApiKey();
    em.findOne.mockResolvedValue(apiKey);

    const expiresAt = new Date(Date.now() + 60_000);
    const permissions = ["Workspace:update"];
    await expect(
      service.updateWorkspaceKey(apiKey.id, new TestWorkspace(), {
        enabled: false,
        expiresAt,
        name: "Renamed",
        permissions,
      }),
    ).resolves.toBe(apiKey);
    await expect(
      service.deleteWorkspaceKey(apiKey.id, new TestWorkspace()),
    ).resolves.toBe(apiKey);

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

    const expired = new TestApiKey();
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
    const disabled = Object.assign(new TestApiKey(), { enabled: false });
    em.findOne.mockResolvedValueOnce(disabled);

    await expect(service.validate("sk-disabled-key")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects keys for deleted workspaces", async () => {
    const { em, service } = createService();
    const apiKey = new TestApiKey();
    apiKey.owner = ref(
      TestWorkspace,
      Object.assign(new TestWorkspace(), {
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
    const user = Object.assign(new TestUser(), {
      banned: true,
      banExpiresAt: null,
    });
    const apiKey = Object.assign(new TestApiKey(), {
      owner: ref(TestUser, user),
    });
    em.findOne.mockResolvedValueOnce(apiKey);

    await expect(service.validate("sk-banned-user-key")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("validates keys with RLS disabled and restores the outer mode", async () => {
    const { em, service } = createService();
    const apiKey = new TestApiKey();
    const workspace = new TestWorkspace();
    const plaintextApiKey = "sk-valid-key";
    em.findOne.mockImplementation((entity, where) => {
      expect(
        RequestContext.get(EntityManager)?.getSessionContext(),
      ).toBeUndefined();
      if (entity === TestApiKey) {
        expect(where).toEqual({
          key: createHash("sha256").update(plaintextApiKey).digest("base64url"),
        });
      }
      return Promise.resolve(entity === TestApiKey ? apiKey : null);
    });

    await RequestContext.child(async () => {
      const sessionContext = mockRlsContext(em);
      await expect(service.validate(plaintextApiKey)).resolves.toEqual({
        apiKey,
        ownerType: "workspace",
        workspace,
      });
      expect(em.getSessionContext()).toEqual(sessionContext);
    });
  });

  it("records successful usage timestamps", async () => {
    const { em, service } = createService();
    const apiKey = new TestApiKey();

    await expect(service.recordUsage(apiKey)).resolves.toBe(apiKey);
    expect(apiKey.lastUsedAt).toBeInstanceOf(Date);
    expect(apiKey.updatedAt).toBe(apiKey.lastUsedAt);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });
});

function it(name: string, callback: () => void | Promise<void>): void {
  baseIt(name, async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(BaseWorkspace, new TestWorkspace());
      RequestContext.set(BaseWorkspaceMember, new TestWorkspaceMember());
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
    create: vi.fn((_entity, data) => Object.assign(new TestApiKey(), data)),
    findOne: vi.fn(),
    flush: vi.fn(),
    persist: vi.fn(),
    remove: vi.fn().mockReturnThis(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);
  const options = {
    ...authorization,
    entities: {
      apiKey: TestApiKey,
      user: TestUser,
      workspace: TestWorkspace,
      workspaceInvitation: class {},
      workspaceMember: TestWorkspaceMember,
    },
  } as unknown as AuthModuleOptions;
  const accessControlService = new AccessControlService(options);
  vi.spyOn(accessControlService, "assertCurrentUser").mockImplementation(
    vi.fn(),
  );
  vi.spyOn(accessControlService, "assertCurrentWorkspaceMember");
  vi.spyOn(accessControlService, "assertUserCan").mockImplementation(vi.fn());
  vi.spyOn(accessControlService, "assertWorkspaceCan").mockImplementation(
    vi.fn(),
  );

  return {
    accessControlService,
    em,
    service: new ApiKeyService<TestApiKey, TestUser, TestWorkspace>(
      em,
      options,
      accessControlService,
    ),
  };
}
