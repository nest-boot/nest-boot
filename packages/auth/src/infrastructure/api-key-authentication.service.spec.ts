import { EntityManager, ref } from "@mikro-orm/core";
import { UnauthorizedException } from "@nestjs/common";

import { Member } from "../entities/member.entity.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { MemberType } from "../enums/member-type.enum.js";
import { hashApiKey } from "../utils/api-key-credential.util.js";
import { ApiKeyAuthenticationService } from "./api-key-authentication.service.js";

function fixture() {
  const user = new User();
  const workspace = new Workspace();
  const userKey = Object.assign(new UserApiKey(), { user: ref(User, user) });
  const member: Member = Object.assign(new Member(), {
    user: ref(User, user),
    workspace: ref(Workspace, workspace),
  });
  const memberKey = Object.assign(new MemberApiKey(), {
    member: ref(Member, member),
  });
  const rows = {
    user: userKey as UserApiKey | null,
    member: memberKey as MemberApiKey | null,
  };
  const em = {
    findOne: vi.fn((entity) =>
      Promise.resolve(entity === UserApiKey ? rows.user : rows.member),
    ),
    nativeUpdate: vi.fn().mockResolvedValue(1),
  };
  return {
    user,
    member,
    workspace,
    userKey,
    memberKey,
    rows,
    em,
    service: new ApiKeyAuthenticationService(em as unknown as EntityManager),
  };
}

describe("API-key authentication", () => {
  it.each(["user", "service-account"])(
    "resolves the member identity of a %s key and rejects disabled members",
    async (kind) => {
      const { service, rows, member, user, workspace } = fixture();
      rows.user = null;
      if (kind === "service-account") {
        member.type = MemberType.SERVICE_ACCOUNT;
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

  it("fails closed for missing, unknown, and ambiguous credentials", async () => {
    const { service, rows, em } = fixture();
    await expect(service.validate("")).rejects.toThrow("Missing API key");
    expect(em.findOne).not.toHaveBeenCalled();
    await expect(service.validate("duplicate")).rejects.toThrow(
      "Invalid API key",
    );
    rows.user = null;
    rows.member = null;
    await expect(service.validate("unknown")).rejects.toThrow(
      "Invalid API key",
    );
  });

  for (const scope of ["user", "member"] as const) {
    it(`authenticates a ${scope} key by hash with only its owner populated`, async () => {
      const { service, rows, em } = fixture();
      rows[scope === "user" ? "member" : "user"] = null;
      const key = rows[scope];
      await expect(service.validate("plaintext")).resolves.toMatchObject({
        apiKey: key,
        ownerType: scope,
      });
      expect(em.findOne).toHaveBeenCalledWith(
        UserApiKey,
        { key: hashApiKey("plaintext") },
        { populate: ["user"] },
      );
      expect(em.findOne).toHaveBeenCalledWith(
        MemberApiKey,
        { key: hashApiKey("plaintext") },
        { populate: ["member.workspace", "member.user"] },
      );
    });

    it.each(["disabled", "expired"])(
      `rejects %s ${scope} keys`,
      async (state) => {
        const { service, rows, userKey, memberKey } = fixture();
        rows[scope === "user" ? "member" : "user"] = null;
        const key = scope === "user" ? userKey : memberKey;
        if (state === "disabled") key.enabled = false;
        else key.expiresAt = new Date(0);
        await expect(service.validate("plaintext")).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    it(`records usage only in the ${scope} table`, async () => {
      const { service, userKey, memberKey, em } = fixture();
      const key = scope === "user" ? userKey : memberKey;
      await expect(service.recordUsage(key)).resolves.toBe(key);
      expect(em.nativeUpdate).toHaveBeenCalledExactlyOnceWith(
        scope === "user" ? UserApiKey : MemberApiKey,
        { id: key.id },
        { updatedAt: expect.any(Date), lastUsedAt: expect.any(Date) },
      );
    });
  }

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
      UserApiKey,
      { id: userKey.id },
      { lastUsedAt: expect.any(Date), updatedAt: expect.any(Date) },
    );
    expect(em.nativeUpdate).not.toHaveBeenCalled();
  });
});
