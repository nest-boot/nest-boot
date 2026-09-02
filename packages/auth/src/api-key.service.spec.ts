/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import type { CryptService } from "@nest-boot/crypt";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Mocked } from "vitest";

import { ApiKeyService } from "./api-key.service.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type {
  AuthApiKeyEntity,
  AuthWorkspaceEntity,
  AuthWorkspaceMemberEntity,
} from "./interfaces/auth-entities.interface.js";

class TestWorkspace implements AuthWorkspaceEntity {
  id = "workspace-1";
  name = "Acme";
}

class TestWorkspaceMember implements AuthWorkspaceMemberEntity {
  id = "member-1";
  name = "Alice";
  role = "MEMBER" as const;
  status = "ACTIVE" as const;
  workspace = { id: "workspace-1" } as AuthWorkspaceMemberEntity["workspace"];
}

class TestApiKey implements AuthApiKeyEntity {
  id = "api-key-1";
  name = "Deploy key";
  keyId = "0123456789abcdef";
  keyPrefix = "sk-";
  encryptedSecret = "encrypted-secret";
  updatedAt = new Date();
  expiresAt: Date | null = null;
  workspace = { id: "workspace-1" } as TestWorkspace;
  member = {
    id: "member-1",
    loadOrFail: vi.fn(),
  } as never;
}

describe("ApiKeyService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("creates a prefixed key and stores only its encrypted secret", async () => {
    vi.stubEnv("API_KEY_PREFIX", "nb-");
    const { cryptService, em, service } = createService();
    const workspace = new TestWorkspace();
    const member = new TestWorkspaceMember();
    member.workspace = workspace as never;

    const result = await service.createKey(workspace, member, {
      name: "Deploy key",
    });

    expect(result.apiKey).toMatch(/^nb-[0-9a-f]{32}$/);
    const secret = result.apiKey.slice(-16);
    expect(cryptService.encrypt).toHaveBeenCalledWith(secret);
    expect(em.create).toHaveBeenCalledWith(
      TestApiKey,
      expect.objectContaining({
        encryptedSecret: "encrypted-secret",
        member,
        name: "Deploy key",
        workspace,
      }),
    );
    expect(JSON.stringify(result.entity)).not.toContain(secret);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it("rejects inactive members and past expiration timestamps", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const member = Object.assign(new TestWorkspaceMember(), {
      status: "DISABLED" as const,
    });

    await expect(
      service.createKey(workspace, member, { name: "Deploy key" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    member.status = "ACTIVE";
    await expect(
      service.createKey(workspace, member, {
        expiresAt: new Date(Date.now() - 1_000),
        name: "Deploy key",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("rejects invited members", async () => {
    const { em, service } = createService();
    const member = Object.assign(new TestWorkspaceMember(), {
      status: "INVITING" as const,
    });

    await expect(
      service.createKey(new TestWorkspace(), member, { name: "Deploy key" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("allows administrators to create keys for another workspace member", async () => {
    const { em, service } = createService();
    const workspace = new TestWorkspace();
    const owner = Object.assign(new TestWorkspaceMember(), {
      id: "owner-1",
      role: "OWNER" as const,
    });
    const target = Object.assign(new TestWorkspaceMember(), {
      id: "member-2",
    });
    em.findOne.mockResolvedValueOnce(target);

    await service.createKey(workspace, owner, {
      name: "Member key",
      workspaceMemberId: target.id,
    });

    expect(em.findOne).toHaveBeenCalledWith(TestWorkspaceMember, {
      id: target.id,
      workspace,
    });
    expect(em.create).toHaveBeenCalledWith(
      TestApiKey,
      expect.objectContaining({ member: target }),
    );
  });

  it("rejects cross-member creation without a management role", async () => {
    const { em, service } = createService();

    await expect(
      service.createKey(new TestWorkspace(), new TestWorkspaceMember(), {
        name: "Member key",
        workspaceMemberId: "member-2",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it("rejects creation from a member of another workspace", async () => {
    const { em, service } = createService();
    const member = Object.assign(new TestWorkspaceMember(), {
      role: "OWNER" as const,
      workspace: {
        id: "workspace-2",
      } as AuthWorkspaceMemberEntity["workspace"],
    });

    await expect(
      service.createKey(new TestWorkspace(), member, { name: "Cross key" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.create).not.toHaveBeenCalled();
  });

  it("reports a missing selected member", async () => {
    const { em, service } = createService();
    const owner = Object.assign(new TestWorkspaceMember(), {
      role: "OWNER" as const,
    });
    em.findOne.mockResolvedValueOnce(null);

    await expect(
      service.createKey(new TestWorkspace(), owner, {
        name: "Member key",
        workspaceMemberId: "missing",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("limits member lists to their own keys and lets managers list the workspace", () => {
    const { service } = createService();
    const workspace = new TestWorkspace();
    const member = new TestWorkspaceMember();
    const owner = Object.assign(new TestWorkspaceMember(), {
      role: "OWNER" as const,
    });

    expect(service.getListFilter(workspace, member)).toEqual({
      member,
      workspace,
    });
    expect(service.getListFilter(workspace, owner)).toEqual({ workspace });
  });

  it("rejects list filters for a member of another workspace", () => {
    const { service } = createService();
    const member = Object.assign(new TestWorkspaceMember(), {
      workspace: {
        id: "workspace-2",
      } as AuthWorkspaceMemberEntity["workspace"],
    });

    expect(() => service.getListFilter(new TestWorkspace(), member)).toThrow(
      ForbiddenException,
    );
  });

  it("enforces key ownership for reads, updates, and deletion", async () => {
    const { em, service } = createService();
    const apiKey = new TestApiKey();
    apiKey.member.loadOrFail.mockResolvedValue({ id: "member-2" });
    em.findOne.mockResolvedValue(apiKey);
    const member = new TestWorkspaceMember();

    await expect(service.getApiKey(apiKey.id, member)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.updateKey(apiKey.id, member, { name: "New" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteKey(apiKey.id, member)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("does not let managers access keys from another workspace", async () => {
    const { em, service } = createService();
    const apiKey = new TestApiKey();
    apiKey.workspace = { id: "workspace-2" } as AuthApiKeyEntity["workspace"];
    apiKey.member.loadOrFail.mockResolvedValue({ id: "member-2" });
    em.findOne.mockResolvedValue(apiKey);
    const owner = Object.assign(new TestWorkspaceMember(), {
      role: "OWNER" as const,
    });

    await expect(service.getApiKey(apiKey.id, owner)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("updates and deletes accessible keys", async () => {
    const { em, service } = createService();
    const apiKey = new TestApiKey();
    apiKey.member.loadOrFail.mockResolvedValue({ id: "member-1" });
    em.findOne.mockResolvedValue(apiKey);
    const member = new TestWorkspaceMember();

    await expect(
      service.updateKey(apiKey.id, member, { name: "Renamed" }),
    ).resolves.toBe(apiKey);
    await expect(service.deleteKey(apiKey.id, member)).resolves.toBe(apiKey);

    expect(apiKey.name).toBe("Renamed");
    expect(em.remove).toHaveBeenCalledWith(apiKey);
    expect(em.flush).toHaveBeenCalledTimes(2);
  });

  it("rejects missing, malformed, expired, disabled, and mismatched keys", async () => {
    const { cryptService, em, service } = createService();

    await expect(service.validate("")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.validate("invalid")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const expired = new TestApiKey();
    expired.expiresAt = new Date(Date.now() - 1_000);
    em.findOne.mockResolvedValueOnce(expired);
    cryptService.decrypt.mockResolvedValueOnce("abcdef0123456789");
    em.findOne.mockResolvedValueOnce(new TestWorkspaceMember());
    em.findOne.mockResolvedValueOnce(new TestWorkspace());
    await expect(
      service.validate("sk-0123456789abcdefabcdef0123456789"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    em.findOne.mockReset();
    const mismatched = new TestApiKey();
    em.findOne.mockResolvedValueOnce(mismatched);
    cryptService.decrypt.mockResolvedValueOnce("0000000000000000");
    await expect(
      service.validate("sk-0123456789abcdefabcdef0123456789"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a key when its plaintext prefix was changed", async () => {
    const { cryptService, em, service } = createService();
    em.findOne.mockResolvedValueOnce(new TestApiKey());

    await expect(
      service.validate("xx-0123456789abcdefabcdef0123456789"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cryptService.decrypt).not.toHaveBeenCalled();
  });

  it("rejects keys for inactive members and deleted workspaces", async () => {
    const { cryptService, em, service } = createService();
    const apiKey = new TestApiKey();
    const member = Object.assign(new TestWorkspaceMember(), {
      status: "INVITE_EXPIRED" as const,
    });
    em.findOne
      .mockResolvedValueOnce(apiKey)
      .mockResolvedValueOnce(member)
      .mockResolvedValueOnce(new TestWorkspace());
    cryptService.decrypt.mockResolvedValueOnce("abcdef0123456789");

    await expect(
      service.validate("sk-0123456789abcdefabcdef0123456789"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    em.findOne.mockReset();
    em.findOne
      .mockResolvedValueOnce(apiKey)
      .mockResolvedValueOnce(new TestWorkspaceMember())
      .mockResolvedValueOnce(null);
    cryptService.decrypt.mockResolvedValueOnce("abcdef0123456789");
    await expect(
      service.validate("sk-0123456789abcdefabcdef0123456789"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("validates keys with RLS disabled and restores the outer mode", async () => {
    const { cryptService, em, service } = createService();
    const apiKey = new TestApiKey();
    const member = new TestWorkspaceMember();
    const workspace = new TestWorkspace();
    em.findOne.mockImplementation((entity) => {
      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);
      return Promise.resolve(
        entity === TestApiKey
          ? apiKey
          : entity === TestWorkspaceMember
            ? member
            : workspace,
      );
    });
    cryptService.decrypt.mockResolvedValue("abcdef0123456789");

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.ENABLED);
      await expect(
        service.validate("sk-0123456789abcdefabcdef0123456789"),
      ).resolves.toEqual({ apiKey, workspace, workspaceMember: member });
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

function createService() {
  const em = {
    create: vi.fn((_entity, data) => Object.assign(new TestApiKey(), data)),
    findOne: vi.fn(),
    flush: vi.fn(),
    persist: vi.fn(),
    remove: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);
  const cryptService = {
    decrypt: vi.fn(),
    encrypt: vi.fn(() => Promise.resolve("encrypted-secret")),
  } as unknown as Mocked<CryptService>;
  const options = {
    entities: {
      apiKey: TestApiKey,
      workspace: TestWorkspace,
      workspaceMember: TestWorkspaceMember,
    },
  } as unknown as AuthModuleOptions;

  return {
    cryptService,
    em,
    service: new ApiKeyService<TestApiKey, TestWorkspace, TestWorkspaceMember>(
      em,
      cryptService,
      options,
    ),
  };
}
