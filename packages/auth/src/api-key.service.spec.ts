/* eslint-disable @typescript-eslint/unbound-method */
import { createHash } from "node:crypto";

import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Mocked } from "vitest";

import { ApiKeyService } from "./api-key.service.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type { AuthorizationService } from "./authorization.service.js";
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
  override status = "ACTIVE" as const;
  override permissions: string[] = [];
  override workspace = {
    id: "workspace-1",
  } as BaseWorkspaceMember["workspace"];
}

class TestApiKey extends BaseApiKey {
  override id = "api-key-1";
  override name = "Deploy key";
  override start = "sk-01234";
  override prefix = "sk-";
  override key = "hashed-key";
  override enabled = true;
  override permissions: string[] = [];
  override updatedAt = new Date();
  override lastUsedAt: Date | null = null;
  override expiresAt: Date | null = null;
  override owner = new TestWorkspace() as BaseApiKey["owner"];
}

describe("ApiKeyService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("creates a prefixed key and stores only its SHA-256 hash", async () => {
    vi.stubEnv("API_KEY_PREFIX", "nb-");
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = new TestWorkspaceMember();
    member.workspace = workspace as never;

    const result = await service.createWorkspaceKey(workspace, member, {
      name: "Deploy key",
    });

    expect(result.apiKey).toMatch(/^nb-[A-Za-z0-9_-]{64}$/);
    expect(em.create).toHaveBeenCalledWith(
      TestApiKey,
      expect.objectContaining({
        enabled: true,
        key: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        name: "Deploy key",
        permissions: [],
        prefix: "nb-",
        start: result.apiKey.slice(0, 8),
        owner: workspace,
      }),
    );
    expect(JSON.stringify(result.entity)).not.toContain(result.apiKey);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("stores workspace permissions as enum values", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = new TestWorkspaceMember();
    const permissions = ["workspace:update"];

    await service.createWorkspaceKey(workspace, member, {
      name: "Deploy key",
      permissions,
    });

    expect(em.create).toHaveBeenCalledWith(
      TestApiKey,
      expect.objectContaining({ permissions }),
    );
  });

  it("creates, lists, updates, and deletes keys owned by the current user", async () => {
    const { em, service } = createService();
    const user = new TestUser();
    user.permissions = ["user:get"];
    const created = await service.createUserKey(user, {
      name: "Personal automation",
      permissions: ["user:get", "workspace:update"],
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
    const permissions = ["user:get", "workspace:update"];
    const user = new TestUser();
    user.permissions = ["user:get"];

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
    const member = new TestWorkspaceMember();

    await expect(
      service.createWorkspaceKey(workspace, member, {
        name: "Invalid workspace key",
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "Workspace API key contains unknown permissions: user:get",
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
    const member = new TestWorkspaceMember();
    const user = new TestUser();
    user.permissions = ["project:read"];

    await service.createWorkspaceKey(workspace, member, {
      name: "Deployment key",
      permissions: ["deployment:run"],
    });
    await service.createUserKey(user, {
      name: "Project deployment key",
      permissions: ["project:read", "deployment:run"],
    });
    await expect(
      service.createWorkspaceKey(workspace, member, {
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
    const user = new TestUser();

    await expect(
      service.createUserKey(user, {
        name: "Workspace automation",
        permissions: ["workspace:update"],
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createUserKey(user, {
        name: "Escalated user key",
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "User API key permissions exceed owner permissions: user:get",
    );

    user.roles = ["admin"];
    await expect(
      service.createUserKey(user, {
        name: "Administrator key",
        permissions: ["user:get"],
      }),
    ).resolves.toBeDefined();
    expect(em.create).toHaveBeenCalledTimes(2);
  });

  it("prevents workspace keys from exceeding the issuing member's permissions", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = new TestWorkspaceMember();
    member.roles = ["admin"];

    await expect(
      service.createWorkspaceKey(workspace, member, {
        name: "Escalated workspace key",
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow(
      "Workspace API key permissions exceed issuer permissions: workspace:delete",
    );

    member.permissions = ["workspace:delete"];
    await expect(
      service.createWorkspaceKey(workspace, member, {
        name: "Direct permission key",
        permissions: ["workspace:delete"],
      }),
    ).resolves.toBeDefined();
    expect(em.create).toHaveBeenCalledOnce();
  });

  it("validates updated API-key permissions according to the owner type", async () => {
    const { em, service } = createService();
    const workspaceKey = new TestApiKey();
    em.findOne.mockResolvedValue(workspaceKey);

    await expect(
      service.updateWorkspaceKey(workspaceKey.id, new TestWorkspaceMember(), {
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "Workspace API key contains unknown permissions: user:get",
    );

    const user = new TestUser();
    const userKey = Object.assign(new TestApiKey(), {
      owner: user as BaseApiKey["owner"],
    });
    em.findOne.mockResolvedValue(userKey);
    await expect(
      service.updateUserKey(userKey.id, user, {
        permissions: ["workspace:update"],
      }),
    ).resolves.toBe(userKey);
    expect(userKey.permissions).toEqual(["workspace:update"]);
  });

  it("enforces owner permission ceilings when API-key permissions are updated", async () => {
    const { em, service } = createService();
    const member = new TestWorkspaceMember();
    member.roles = ["admin"];
    const workspaceKey = new TestApiKey();
    em.findOne.mockResolvedValue(workspaceKey);

    await expect(
      service.updateWorkspaceKey(workspaceKey.id, member, {
        permissions: ["workspace:delete"],
      }),
    ).rejects.toThrow(
      "Workspace API key permissions exceed issuer permissions: workspace:delete",
    );
    expect(workspaceKey.permissions).toEqual([]);

    const user = new TestUser();
    const userKey = Object.assign(new TestApiKey(), {
      owner: user as BaseApiKey["owner"],
    });
    em.findOne.mockResolvedValue(userKey);
    await expect(
      service.updateUserKey(userKey.id, user, {
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "User API key permissions exceed owner permissions: user:get",
    );
    expect(userKey.permissions).toEqual([]);
    expect(em.flush).not.toHaveBeenCalled();
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

  it("rejects invalid prefixes and permission values", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = new TestWorkspaceMember();

    await expect(
      service.createWorkspaceKey(workspace, member, {
        name: "Invalid prefix",
        prefix: "",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createWorkspaceKey(workspace, member, {
        name: "Invalid permissions",
        permissions: [""],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("rejects inactive members and past expiration timestamps", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = Object.assign(new TestWorkspaceMember(), {
      status: "DISABLED" as const,
    });

    await expect(
      service.createWorkspaceKey(workspace, member, { name: "Deploy key" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    member.status = "ACTIVE";
    await expect(
      service.createWorkspaceKey(workspace, member, {
        expiresAt: new Date(Date.now() - 1_000),
        name: "Deploy key",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("checks workspace permissions instead of hard-coding an owner role", async () => {
    const { authorizationService, service } = createService();
    const workspace = new TestWorkspace();
    const member = Object.assign(new TestWorkspaceMember(), {
      roles: ["custom-api-key-manager"],
      workspace,
    });

    await service.createWorkspaceKey(workspace, member, {
      name: "Workspace key",
    });

    expect(
      authorizationService.assertCurrentWorkspaceMember,
    ).toHaveBeenCalledWith(member);
    expect(authorizationService.assertWorkspaceCan).toHaveBeenCalledWith(
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

    await expect(
      service.createWorkspaceKey(new TestWorkspace(), member, {
        name: "Cross key",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("checks workspace read permission before building a list filter", () => {
    const { authorizationService, service } = createService();
    const workspace = new TestWorkspace();
    const member = new TestWorkspaceMember();

    expect(service.getWorkspaceListFilter(workspace, member)).toEqual({
      owner: workspace,
    });
    expect(authorizationService.assertWorkspaceCan).toHaveBeenCalledWith(
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

    expect(() =>
      service.getWorkspaceListFilter(new TestWorkspace(), member),
    ).toThrow(ForbiddenException);
  });

  it("rejects workspace key access before persistence when permission fails", async () => {
    const { authorizationService, em, service } = createService();
    const apiKey = new TestApiKey();
    em.findOne.mockResolvedValue(apiKey);
    const member = new TestWorkspaceMember();
    vi.mocked(authorizationService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );

    await expect(
      service.getWorkspaceApiKey(apiKey.id, member),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateWorkspaceKey(apiKey.id, member, { name: "New" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deleteWorkspaceKey(apiKey.id, member),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("does not let owners access keys from another workspace", async () => {
    const { em, service } = createService();
    const apiKey = new TestApiKey();
    apiKey.owner = Object.assign(new TestWorkspace(), {
      id: "workspace-2",
    }) as BaseApiKey["owner"];
    em.findOne.mockResolvedValue(apiKey);
    const owner = Object.assign(new TestWorkspaceMember(), {
      roles: ["owner"],
    });

    await expect(
      service.getWorkspaceApiKey(apiKey.id, owner),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updates and deletes accessible keys", async () => {
    const { em, service } = createService();
    const apiKey = new TestApiKey();
    em.findOne.mockResolvedValue(apiKey);
    const member = new TestWorkspaceMember();

    const expiresAt = new Date(Date.now() + 60_000);
    const permissions = ["workspace:update"];
    await expect(
      service.updateWorkspaceKey(apiKey.id, member, {
        enabled: false,
        expiresAt,
        name: "Renamed",
        permissions,
      }),
    ).resolves.toBe(apiKey);
    await expect(service.deleteWorkspaceKey(apiKey.id, member)).resolves.toBe(
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
    apiKey.owner = Object.assign(new TestWorkspace(), {
      deletedAt: new Date(),
    }) as BaseApiKey["owner"];
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
      owner: user as BaseApiKey["owner"],
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
      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);
      if (entity === TestApiKey) {
        expect(where).toEqual({
          key: createHash("sha256").update(plaintextApiKey).digest("base64url"),
        });
      }
      return Promise.resolve(entity === TestApiKey ? apiKey : null);
    });

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.ENABLED);
      await expect(service.validate(plaintextApiKey)).resolves.toEqual({
        apiKey,
        ownerType: "workspace",
        workspace,
      });
      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.ENABLED);
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

function createService(
  authorization: Pick<AuthModuleOptions, "user" | "workspace"> = {},
) {
  const em = {
    create: vi.fn((_entity, data) => Object.assign(new TestApiKey(), data)),
    findOne: vi.fn(),
    flush: vi.fn(),
    persist: vi.fn(),
    remove: vi.fn(),
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
  const authorizationService = {
    assertCurrentUser: vi.fn(),
    assertCurrentWorkspaceMember: vi.fn(),
    assertUserCan: vi.fn(),
    assertWorkspaceCan: vi.fn(),
  } as unknown as AuthorizationService;

  return {
    authorizationService,
    em,
    service: new ApiKeyService<
      TestApiKey,
      TestUser,
      TestWorkspace,
      TestWorkspaceMember
    >(em, options, authorizationService),
  };
}
