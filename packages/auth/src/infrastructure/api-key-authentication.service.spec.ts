import { EntityManager, ref } from "@mikro-orm/core";
import { UnauthorizedException } from "@nestjs/common";

import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { hashApiKey } from "../utils/api-key-credential.util.js";
import { ApiKeyAuthenticationService } from "./api-key-authentication.service.js";

function fixture() {
  const user = new User();
  const workspace = new Workspace();
  const userKey = Object.assign(new UserApiKey(), { user: ref(User, user) });
  const workspaceKey = Object.assign(new WorkspaceApiKey(), {
    workspace: ref(Workspace, workspace),
  });
  const rows = {
    user: userKey as UserApiKey | null,
    workspace: workspaceKey as WorkspaceApiKey | null,
  };
  const em = {
    findOne: vi.fn((entity) =>
      Promise.resolve(entity === UserApiKey ? rows.user : rows.workspace),
    ),
    nativeUpdate: vi.fn().mockResolvedValue(1),
  };
  return {
    user,
    workspace,
    userKey,
    workspaceKey,
    rows,
    em,
    service: new ApiKeyAuthenticationService(em as unknown as EntityManager),
  };
}

describe("API-key authentication", () => {
  it("fails closed for missing, unknown, and ambiguous credentials", async () => {
    const { service, rows, em } = fixture();
    await expect(service.validate("")).rejects.toThrow("Missing API key");
    expect(em.findOne).not.toHaveBeenCalled();
    await expect(service.validate("duplicate")).rejects.toThrow(
      "Invalid API key",
    );
    rows.user = null;
    rows.workspace = null;
    await expect(service.validate("unknown")).rejects.toThrow(
      "Invalid API key",
    );
  });

  for (const scope of ["user", "workspace"] as const) {
    it(`authenticates a ${scope} key by hash with only its owner populated`, async () => {
      const { service, rows, em } = fixture();
      rows[scope === "user" ? "workspace" : "user"] = null;
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
        WorkspaceApiKey,
        { key: hashApiKey("plaintext") },
        { populate: ["workspace"] },
      );
    });

    it.each(["disabled", "expired"])(
      `rejects %s ${scope} keys`,
      async (state) => {
        const { service, rows, userKey, workspaceKey } = fixture();
        rows[scope === "user" ? "workspace" : "user"] = null;
        const key = scope === "user" ? userKey : workspaceKey;
        if (state === "disabled") key.enabled = false;
        else key.expiresAt = new Date(0);
        await expect(service.validate("plaintext")).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    it(`records usage only in the ${scope} table`, async () => {
      const { service, userKey, workspaceKey, em } = fixture();
      const key = scope === "user" ? userKey : workspaceKey;
      await expect(service.recordUsage(key)).resolves.toBe(key);
      expect(em.nativeUpdate).toHaveBeenCalledExactlyOnceWith(
        scope === "user" ? UserApiKey : WorkspaceApiKey,
        { id: key.id },
        { updatedAt: expect.any(Date), lastUsedAt: expect.any(Date) },
      );
    });
  }

  it("rejects active user bans but permits expired bans", async () => {
    const { service, rows, user, userKey } = fixture();
    rows.workspace = null;
    rows.user = userKey;
    user.banned = true;
    await expect(service.validate("user")).rejects.toThrow("Invalid API key");
    user.banExpiresAt = new Date(0);
    await expect(service.validate("user")).resolves.toMatchObject({ user });
  });
});
