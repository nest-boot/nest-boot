import { ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import {
  apiKeyTest,
  createService,
  createTestUser,
} from "../../../test/fixtures/api-key-service.fixture.js";
import { createTestApiKeyService } from "../../../test/fixtures/auth-context.fixture.js";
import { stageIdentity } from "../../../test/fixtures/auth-context.fixture.js";
import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { AuthAbility } from "../../common/auth.ability.js";
import { User } from "../../core/entities/user.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { toApiKeyView } from "../utils/api-key-view.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";

apiKeyTest(
  "writes native credential fields and publishes a detached ORM identity without its hash",
  async () => {
    const { em } = createService();
    const options = withAuthTestFeatures({});
    const user = createTestUser();
    const record = Object.assign(new ApiKey(), {
      owner: ref(User, user),
      key: "persisted-hash",
      name: "Original",
      permissions: ["user-api-key:read"],
    });
    stageIdentity({ user, apiKey: toApiKeyView(record) });
    const before = getCurrentApiKey();
    em.nativeUpdate.mockImplementationOnce(() => {
      expect(getCurrentApiKey()).toBe(before);
      expect(before?.name).toBe("Original");
      return Promise.resolve(1);
    });
    const updated = await createTestApiKeyService(em, options).update(
      record,
      { name: "Renamed" },
      undefined,
    );
    expect(updated).not.toBe(record);
    expect(record.name).toBe("Original");
    expect(em.nativeUpdate.mock.calls[0]).toEqual([
      ApiKey,
      { id: record.id, ownerType: "user" },
      { name: "Renamed", updatedAt: expect.any(Date) },
    ]);
    expect(updated).toBeInstanceOf(ApiKey);
    const identity = getCurrentApiKey();
    expect(identity).toBeInstanceOf(ApiKey);
    expect(identity).not.toBe(record);
    expect(identity).toMatchObject({ id: record.id, name: "Renamed" });
    expect(identity).not.toHaveProperty("key");
    expect(identity).toHaveProperty("isInitialized");
    record.permissions.push("later:grant");
    expect(identity?.permissions).toEqual(["user-api-key:read"]);
  },
);

apiKeyTest(
  "retains native input fields and the previous identity when persistence fails",
  async () => {
    const { em } = createService();
    const user = createTestUser();
    const record = Object.assign(new ApiKey(), {
      owner: ref(User, user),
      key: "persisted-hash",
      name: "Original",
      permissions: ["user-api-key:read"],
    });
    stageIdentity({ user, apiKey: toApiKeyView(record) });
    const before = getCurrentApiKey();
    em.nativeUpdate.mockRejectedValueOnce(new Error("Write failed"));
    await expect(
      createTestApiKeyService(em, withAuthTestFeatures({})).update(
        record,
        { name: "Denied" },
        ["user-api-key:write"],
      ),
    ).rejects.toThrow("Write failed");
    expect(record).toMatchObject({
      name: "Original",
      permissions: ["user-api-key:read"],
      key: "persisted-hash",
    });
    expect(getCurrentApiKey()).toBe(before);
    expect(RequestContext.get(User)).toBe(user);
  },
);

for (const [Owner, subject] of [
  [User, "UserApiKey"],
  [WorkspaceMember, "WorkspaceApiKey"],
  [SystemAccount, "SystemApiKey"],
] as const) {
  apiKeyTest(
    `rejects edits outside the authorized ${subject} fields before writing`,
    async () => {
      const { em, authorization } = createService();
      authorization.authorize.mockRestore();
      const record = Object.assign(new ApiKey(), {
        owner: ref(new Owner()),
        name: "Original",
        permissions: [],
      });
      RequestContext.set(
        AuthAbility,
        new AuthAbility([{ action: "write", subject, fields: ["name"] }]),
      );
      await expect(
        createTestApiKeyService(em).update(
          record,
          { permissions: ["user:read"] },
          ["user:read"],
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(em.nativeUpdate.mock.calls).toHaveLength(0);
      expect(em.persist.mock.calls).toHaveLength(0);
      expect(record.permissions).toEqual([]);
    },
  );
}

apiKeyTest(
  "clears an active request when its key has already been revoked",
  async () => {
    const { em } = createService();
    const user = createTestUser();
    const record = Object.assign(new ApiKey(), { owner: ref(User, user) });
    stageIdentity({ user, apiKey: toApiKeyView(record) });
    record.revokedAt = new Date();
    await createTestApiKeyService(em).revoke(record);
    expect(getCurrentApiKey()).toBeNull();
    expect(RequestContext.get(User)).toBeNull();
    expect(em.nativeUpdate.mock.calls).toHaveLength(0);
  },
);

apiKeyTest(
  "rejects an update when the key disappears between lookup and persistence",
  async () => {
    const { em } = createService();
    const user = createTestUser();
    const record = Object.assign(new ApiKey(), {
      owner: ref(User, user),
      name: "Original",
    });
    stageIdentity({ user, apiKey: toApiKeyView(record) });
    const before = getCurrentApiKey();
    em.nativeUpdate.mockResolvedValueOnce(0);
    await expect(
      createTestApiKeyService(em).update(
        record,
        { name: "Missing" },
        undefined,
      ),
    ).rejects.toThrow("API key not found");
    expect(record.name).toBe("Original");
    expect(getCurrentApiKey()).toBe(before);
  },
);

for (const operation of ["update", "revoke", "delete"] as const) {
  apiKeyTest(
    `rejects self-${operation} in an external transaction before persistence`,
    async () => {
      const { em } = createService();
      const user = createTestUser();
      const record = Object.assign(new ApiKey(), {
        owner: ref(User, user),
        name: "Original",
      });
      stageIdentity({ user, apiKey: toApiKeyView(record) });
      const identity = getCurrentApiKey();
      em.isInTransaction.mockReturnValue(true);
      const service = createTestApiKeyService(em);
      await expect(
        operation === "update"
          ? service.update(record, { name: "Denied" }, undefined)
          : service[operation](record),
      ).rejects.toThrow(
        "Change the current API key outside an active transaction",
      );
      expect(em.nativeUpdate.mock.calls).toHaveLength(0);
      expect(em.remove.mock.calls).toHaveLength(0);
      expect(em.flush.mock.calls).toHaveLength(0);
      expect(record.name).toBe("Original");
      expect(getCurrentApiKey()).toBe(identity);
      expect(RequestContext.get(User)).toBe(user);
    },
  );
}
