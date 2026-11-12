import { ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import {
  apiKeyTest,
  createService,
  createTestUser,
} from "../../test/fixtures/api-key-service.fixture.js";
import { withAuthTestFeatures } from "../../test/fixtures/enabled-auth-features.fixture.js";
import { User } from "../core/entities/user.entity.js";
import { RequestIdentity } from "../core/request-identity.js";
import { ApiKeyLifecycle } from "./api-key-lifecycle.js";
import { ApiKey } from "./entities/api-key.entity.js";
import { UserApiKey } from "./objects/user-api-key.object.js";
import { toApiKeyView } from "./utils/api-key-view.util.js";
import { getCurrentApiKey } from "./utils/get-current-api-key.util.js";

apiKeyTest(
  "persists a native entity and publishes only a detached, credential-free identity",
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
    RequestIdentity.stage({ user, apiKey: toApiKeyView(record) });
    const before = getCurrentApiKey();
    em.flush.mockImplementationOnce(() => {
      expect(getCurrentApiKey()).toBe(before);
      expect(before?.name).toBe("Original");
      return Promise.resolve();
    });
    const updated = await ApiKeyLifecycle.update(
      em,
      options,
      record,
      { name: "Renamed" },
      undefined,
    );
    expect(updated).toBe(record);
    expect(em.persist.mock.calls[0]?.[0]).toBe(record);
    expect(updated).toBeInstanceOf(ApiKey);
    const identity = getCurrentApiKey();
    expect(identity).toBeInstanceOf(UserApiKey);
    expect(identity).not.toBe(record);
    expect(identity).toMatchObject({ id: record.id, name: "Renamed" });
    expect(identity).not.toHaveProperty("key");
    expect(identity).not.toHaveProperty("isInitialized");
    record.permissions.push("later:grant");
    expect(identity?.permissions).toEqual(["user-api-key:read"]);
  },
);

apiKeyTest(
  "rolls back native fields and retains the previous identity when persistence fails",
  async () => {
    const { em } = createService();
    const user = createTestUser();
    const record = Object.assign(new ApiKey(), {
      owner: ref(User, user),
      key: "persisted-hash",
      name: "Original",
      permissions: ["user-api-key:read"],
    });
    RequestIdentity.stage({ user, apiKey: toApiKeyView(record) });
    const before = getCurrentApiKey();
    em.flush.mockRejectedValueOnce(new Error("Write failed"));
    await expect(
      ApiKeyLifecycle.update(
        em,
        withAuthTestFeatures({}),
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
