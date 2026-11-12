import { EntityManager, ref } from "@mikro-orm/core";
import { UnauthorizedException } from "@nestjs/common";

import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { User } from "../../core/entities/user.entity.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { WorkspaceMemberType } from "../../workspace/enums/workspace-member-type.enum.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { SystemApiKey } from "../objects/system-api-key.object.js";
import { UserApiKey } from "../objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
import { hashApiKey } from "../utils/api-key-credential.util.js";
import { ApiKeyAuthenticationService } from "./api-key-authentication.service.js";

/**
 * Returns isolated identity, persistence mocks, and services for the test.
 * @returns Isolated identity, persistence mocks, and services for the test.
 */
function fixture() {
  const user = new User();
  const workspace = new Workspace();
  const userKey = Object.assign(new UserApiKey(new ApiKey()), {
    user: ref(User, user),
  });
  const member: WorkspaceMember = Object.assign(new WorkspaceMember(), {
    user: ref(User, user),
    workspace: ref(Workspace, workspace),
  });
  const memberKey = Object.assign(new WorkspaceApiKey(new ApiKey()), {
    member: ref(WorkspaceMember, member),
  });
  const systemAccount = new SystemAccount();
  const systemKey = Object.assign(new SystemApiKey(new ApiKey()), {
    owner: ref(SystemAccount, systemAccount),
  });
  const identities = {
    user: user as User | null,
    member: member as WorkspaceMember | null,
    system: systemAccount as SystemAccount | null,
  };
  const rows = {
    user: userKey as UserApiKey | null,
    member: memberKey as WorkspaceApiKey | null,
    system: null as SystemApiKey | null,
  };
  const em = {
    findOne: vi.fn((entity: object) =>
      Promise.resolve(
        entity === ApiKey
          ? (rows.user ?? rows.member ?? rows.system)
          : entity === User
            ? identities.user
            : entity === WorkspaceMember
              ? identities.member
              : identities.system,
      ),
    ),
    populate: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
    nativeUpdate: vi.fn().mockResolvedValue(1),
  };
  return {
    user,
    member,
    workspace,
    userKey,
    memberKey,
    rows,
    identities,
    systemAccount,
    systemKey,
    em,
    service: new ApiKeyAuthenticationService(
      em as unknown as EntityManager,
      withAuthTestFeatures({
        workspace: { enabled: true },
      }),
    ),
  };
}

describe("API-key authentication", () => {
  it.each(["user", "service-account"])(
    "resolves the member identity of a %s key and rejects disabled members",
    async (kind) => {
      const { service, rows, member, user, workspace } = fixture();
      rows.user = null;
      if (kind === "service-account") {
        member.type = WorkspaceMemberType.SERVICE_ACCOUNT;
        member.user = null;
      }
      await expect(service.validate("key")).resolves.toMatchObject({
        member,
        workspace,
        user: kind === "user" ? user : null,
      });
      member.status = "DISABLED";
      await expect(service.validate("key")).rejects.toThrow("Invalid API key");
    },
  );
  it("rejects member keys while their login user is banned", async () => {
    const { service, rows, user } = fixture();
    rows.user = null;
    user.banned = true;
    await expect(service.validate("key")).rejects.toThrow("Invalid API key");
    user.banExpiresAt = new Date(0);
    await expect(service.validate("key")).resolves.toMatchObject({ user });
  });
  it("fails closed for missing and unknown credentials", async () => {
    const { service, rows, em } = fixture();
    await expect(service.validate("")).rejects.toThrow("Missing API key");
    expect(em.findOne).not.toHaveBeenCalled();
    rows.user = null;
    rows.member = null;
    await expect(service.validate("unknown")).rejects.toThrow(
      "Invalid API key",
    );
  });
  for (const scope of ["user", "member"] as const) {
    it(`authenticates a ${scope} key by hash with a fresh owner lookup`, async () => {
      const { service, rows, em } = fixture();
      rows[scope === "user" ? "member" : "user"] = null;
      const key = rows[scope];
      await expect(service.validate("plaintext")).resolves.toMatchObject({
        apiKey: key,
        ownerType: scope === "member" ? "workspace_member" : scope,
      });
      expect(em.findOne).toHaveBeenCalledWith(ApiKey, {
        key: hashApiKey("plaintext"),
        ownerType: { $in: ["user", "workspace_member", "system_account"] },
      });
      expect(em.findOne).toHaveBeenCalledWith(
        scope === "user" ? User : WorkspaceMember,
        key?.owner.id,
        {
          refresh: true,
          ...(scope === "member" ? { populate: ["workspace", "user"] } : {}),
        },
      );
      expect(em.findOne).toHaveBeenCalledTimes(2);
    });
    it.each(["disabled", "expired"])(
      `rejects %s ${scope} keys`,
      async (state) => {
        const { service, rows, userKey, memberKey } = fixture();
        rows[scope === "user" ? "member" : "user"] = null;
        const key = scope === "user" ? userKey : memberKey;
        if (state === "disabled") {
          key.enabled = false;
        } else {
          key.expiresAt = new Date(0);
        }
        await expect(service.validate("plaintext")).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );
    it(`records usage only for the ${scope} subtype`, async () => {
      const { service, userKey, memberKey, em } = fixture();
      const key = scope === "user" ? userKey : memberKey;
      await expect(service.recordUsage(key)).resolves.toBe(key);
      expect(em.nativeUpdate).toHaveBeenCalledExactlyOnceWith(
        ApiKey,
        {
          id: key.id,
          ownerType: scope === "member" ? "workspace_member" : scope,
        },
        { updatedAt: expect.any(Date), lastUsedAt: expect.any(Date) },
      );
    });
  }
  it.each(["user", "member", "system"] as const)(
    "rejects a missing %s identity without updating or deleting its audit key",
    async (kind) => {
      const { service, rows, identities, systemKey, em } = fixture();
      rows.user = kind === "user" ? rows.user : null;
      rows.member = kind === "member" ? rows.member : null;
      rows.system = kind === "system" ? systemKey : null;
      identities[kind] = null;
      await expect(service.validate("retained-key")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(em.nativeUpdate).not.toHaveBeenCalled();
    },
  );

  it("propagates database lookup failures without changing the credential", async () => {
    const { service, em, userKey } = fixture();
    em.findOne.mockImplementation((entity: object) =>
      entity === ApiKey
        ? Promise.resolve(userKey)
        : Promise.reject(new Error("database unavailable")),
    );
    await expect(service.validate("key")).rejects.toThrow(
      "database unavailable",
    );
    expect(em.nativeUpdate).not.toHaveBeenCalled();
  });
  it("rejects active user bans but permits expired bans", async () => {
    const { service, rows, user, userKey } = fixture();
    rows.member = null;
    rows.user = userKey;
    user.banned = true;
    await expect(service.validate("user")).rejects.toThrow("Invalid API key");
    user.banExpiresAt = new Date(0);
    await expect(service.validate("user")).resolves.toMatchObject({ user });
  });
  it("captures a scoped recorder without updating or flushing the caller's manager", async () => {
    const { service, em, userKey } = fixture();
    const scoped = { nativeUpdate: vi.fn().mockResolvedValue(1) };
    const fork = vi.fn(() => scoped);
    Object.assign(em, { fork });
    const record = service.captureUsage(userKey);
    expect(fork).toHaveBeenCalledExactlyOnceWith({
      useContext: false,
      keepTransactionContext: true,
    });
    expect(scoped.nativeUpdate).not.toHaveBeenCalled();
    await expect(record()).resolves.toBe(userKey);
    expect(scoped.nativeUpdate).toHaveBeenCalledExactlyOnceWith(
      ApiKey,
      { id: userKey.id, ownerType: "user" },
      { lastUsedAt: expect.any(Date), updatedAt: expect.any(Date) },
    );
    expect(em.nativeUpdate).not.toHaveBeenCalled();
  });
});

describe("optional workspace behavior", () => {
  it.each([
    {},
    { apiKey: { enabled: true } },
    { apiKey: { enabled: false, user: { enabled: true } } },
  ])(
    "rejects disabled credentials before querying persistence (%j)",
    async (options) => {
      const { em } = fixture();
      const service = new ApiKeyAuthenticationService(
        em as unknown as EntityManager,
        options,
      );
      await expect(service.validate("personal-key")).rejects.toThrow(
        "API keys are disabled",
      );
      expect(em.findOne).not.toHaveBeenCalled();
      expect(em.populate).not.toHaveBeenCalled();
    },
  );

  it("authenticates user keys without touching optional member tables", async () => {
    const user = new User();
    const key = Object.assign(new UserApiKey(new ApiKey()), { user });
    const em = {
      findOne: vi.fn(
        (entity: object): Promise<User | UserApiKey | WorkspaceApiKey> =>
          Promise.resolve(entity === ApiKey ? key : user),
      ),
      populate: vi.fn().mockResolvedValue(key),
    };
    const service = new ApiKeyAuthenticationService(
      em as unknown as EntityManager,
      { apiKey: { enabled: true, user: { enabled: true } } },
    );
    await expect(service.validate("personal-key")).resolves.toMatchObject({
      ownerType: "user",
      user,
      apiKey: key,
    });
    expect(em.findOne).toHaveBeenCalledWith(ApiKey, {
      key: hashApiKey("personal-key"),
      ownerType: { $in: ["user"] },
    });
    expect(em.findOne).toHaveBeenCalledWith(User, user.id, { refresh: true });
    expect(em.populate).not.toHaveBeenCalled();
    em.findOne.mockResolvedValue(new WorkspaceApiKey(new ApiKey()));
    await expect(service.validate("member-key")).rejects.toThrow(
      "Invalid API key",
    );
    expect(em.findOne).toHaveBeenCalledTimes(3);
    expect(em.populate).not.toHaveBeenCalled();
  });
});
