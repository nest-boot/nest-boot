import assert from "node:assert/strict";

import { EntityManager, ref } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/pglite";
import { getDatabaseConfig } from "@nest-boot/database";
import { RequestContext } from "@nest-boot/request-context";

import { ApiKey } from "../src/api-key/entities/api-key.entity.js";
import { ApiKeyService } from "../src/api-key/services/api-key.service.js";
import { UserApiKeyService } from "../src/api-key/services/user-api-key.service.js";
import { toApiKeyView } from "../src/api-key/utils/api-key-view.util.js";
import { AuthContext } from "../src/core/auth-context.js";
import { AuthTransactionSubscriber } from "../src/core/auth-transaction.subscriber.js";
import { User } from "../src/core/entities/user.entity.js";
import { entities, workspaceEntities } from "../src/index.js";
import { withAuthTestFeatures } from "./fixtures/enabled-auth-features.fixture.js";

const options = withAuthTestFeatures({ workspace: { enabled: true } });

describe("Nest auth providers with native transaction boundaries", () => {
  let orm: MikroORM;
  let context: AuthContext;
  let keys: UserApiKeyService;
  beforeAll(async () => {
    const { metadataProvider } = await getDatabaseConfig();
    orm = await MikroORM.init({
      dbName: "memory://",
      metadataProvider,
      entities: [...entities, ...workspaceEntities],
      metadataCache: { enabled: false },
      context: () =>
        RequestContext.isActive()
          ? RequestContext.get(EntityManager)
          : undefined,
    });
    await orm.em.execute("create role authenticated nologin noinherit");
    await orm.em.execute("create role anonymous nologin noinherit");
    await orm.em.execute("grant anonymous, authenticated to current_user");
    await orm.em.execute(
      "grant usage on schema public to anonymous, authenticated",
    );
    await orm.em.execute(
      "alter default privileges in schema public grant all on tables to anonymous, authenticated",
    );
    await orm.schema.create();
    const transactions = new AuthTransactionSubscriber(orm.em);
    transactions.onModuleInit();
    context = new AuthContext(orm.em, options, transactions);
    keys = new UserApiKeyService(
      orm.em,
      options,
      new ApiKeyService(orm.em, context),
    );
  });
  afterAll(async () => {
    await orm?.close(true);
  });

  /**
   *
   * @param run - Assertions to execute inside the authenticated request.
   */
  async function inRequest(
    run: (data: {
      em: EntityManager;
      key: ApiKey;
      user: User;
    }) => Promise<void>,
  ) {
    const em = orm.em.fork();
    const user = em.create(User, {
      name: "Transaction actor",
      email: `${crypto.randomUUID()}@example.test`,
      roles: ["admin"],
      emailVerified: true,
    });
    const key = em.create(ApiKey, {
      owner: ref(User, user),
      name: "Original",
      key: crypto.randomUUID(),
      permissions: ["user-api-key:write", "user:read"],
    });
    await em.persist([user, key]).flush();
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(EntityManager, em);
      context.initialize({ user, apiKey: toApiKeyView(key) });
      await run({ em, key, user });
    });
  }

  /**
   * Reads retained audit data independently of the request role.
   * @param id - Identifier of the stored credential.
   * @returns Credential reloaded through the base database role.
   */
  async function readStoredKey(id: string): Promise<ApiKey> {
    const admin = orm.em.fork();
    admin.clearSessionContext();
    return await admin.findOneOrFail(ApiKey, id);
  }

  it.each([false, true])(
    "publishes self-revocation only after the outer commit (rollback=%s)",
    async (rollback) => {
      await inRequest(async ({ em, key, user }) => {
        const identity = context.apiKey;
        const mutation = em.transactional(async () => {
          await keys.revokeUserApiKey(key.id);
          expect(context.apiKey).toBe(identity);
          expect(context.user).toBe(user);
          if (rollback) {
            throw new Error("Rollback requested");
          }
        });
        if (rollback) {
          await expect(mutation).rejects.toThrow("Rollback requested");
        } else {
          await mutation;
        }
        const stored = await readStoredKey(key.id);
        if (rollback) {
          expect(stored.revokedAt).toBeNull();
          expect(stored.lastUsedAt).toBeNull();
          expect(context.apiKey).toBe(identity);
          expect(em.getSessionContext()?.role).toBe("authenticated");
        } else {
          expect(stored.revokedAt).toBeInstanceOf(Date);
          expect(stored.lastUsedAt).toEqual(stored.revokedAt);
          expect(context.apiKey).toBeNull();
          expect(context.user).toBeNull();
          expect(em.getSessionContext()?.role).toBe("anonymous");
        }
      });
    },
  );

  it.each(["outer", "savepoint", "none"] as const)(
    "keeps nested revocation attached to its outer transaction (rollback=%s)",
    async (rollback) => {
      await inRequest(async ({ em, key }) => {
        const identity = context.apiKey;
        const outer = em.transactional(async (tx) => {
          const nested = tx.transactional(async () => {
            await keys.revokeUserApiKey(key.id);
            expect(context.apiKey).toBe(identity);
            if (rollback === "savepoint") {
              throw new Error("Savepoint rollback");
            }
          });
          if (rollback === "savepoint") {
            await expect(nested).rejects.toThrow("Savepoint rollback");
          } else {
            await nested;
          }
          expect(context.apiKey).toBe(identity);
          if (rollback === "outer") {
            throw new Error("Outer rollback");
          }
        });
        if (rollback === "outer") {
          await expect(outer).rejects.toThrow("Outer rollback");
        } else {
          await outer;
        }
        const stored = await readStoredKey(key.id);
        expect(Boolean(stored.revokedAt)).toBe(rollback === "none");
        expect(context.apiKey).toBe(rollback === "none" ? null : identity);
      });
    },
  );

  it.each([false, true])(
    "retains the previous credential snapshot until a permission edit commits (rollback=%s)",
    async (rollback) => {
      await inRequest(async ({ em, key }) => {
        const before = context.apiKey;
        assert(before);
        const update = em.transactional(async () => {
          await keys.updateUserApiKey(key.id, { permissions: ["user:read"] });
          expect(context.apiKey).toBe(before);
          expect(context.apiKey?.permissions).toEqual([
            "user-api-key:write",
            "user:read",
          ]);
          if (rollback) {
            throw new Error("Update rollback");
          }
        });
        if (rollback) {
          await expect(update).rejects.toThrow("Update rollback");
        } else {
          await update;
        }
        expect(context.apiKey?.permissions).toEqual(
          rollback ? ["user-api-key:write", "user:read"] : ["user:read"],
        );
        expect((await readStoredKey(key.id)).permissions).toEqual(
          context.apiKey?.permissions,
        );
        expect(context.apiKey).not.toHaveProperty("key");
      });
    },
  );
  it.each(["outer", "savepoint", "none"] as const)(
    "does not replay a rolled-back permission change during outer flush (rollback=%s)",
    async (rollback) => {
      await inRequest(async ({ em, key }) => {
        const identity = context.apiKey;
        const outer = em.transactional(async (tx) => {
          const nested = tx.transactional(async () => {
            await keys.updateUserApiKey(key.id, { permissions: ["user:read"] });
            expect(context.apiKey).toBe(identity);
            if (rollback === "savepoint") {
              throw new Error("Savepoint rollback");
            }
          });
          if (rollback === "savepoint") {
            await expect(nested).rejects.toThrow("Savepoint rollback");
          } else {
            await nested;
          }
          expect(context.apiKey).toBe(identity);
          if (rollback === "outer") {
            throw new Error("Outer rollback");
          }
        });
        if (rollback === "outer") {
          await expect(outer).rejects.toThrow("Outer rollback");
        } else {
          await outer;
        }
        const expected =
          rollback === "none"
            ? ["user:read"]
            : ["user-api-key:write", "user:read"];
        expect((await readStoredKey(key.id)).permissions).toEqual(expected);
        expect(context.apiKey?.permissions).toEqual(expected);
      });
    },
  );

  it.each(["outer", "savepoint", "none"] as const)(
    "publishes key deletion after the outer commit (rollback=%s)",
    async (rollback) => {
      await inRequest(async ({ em, key }) => {
        const identity = context.apiKey;
        const outer = em.transactional(async (tx) => {
          const nested = tx.transactional(async () => {
            await keys.deleteUserApiKey(key.id);
            expect(context.apiKey).toBe(identity);
            if (rollback === "savepoint") {
              throw new Error("Savepoint rollback");
            }
          });
          if (rollback === "savepoint") {
            await expect(nested).rejects.toThrow("Savepoint rollback");
          } else {
            await nested;
          }
          expect(context.apiKey).toBe(identity);
          if (rollback === "outer") {
            throw new Error("Outer rollback");
          }
        });
        if (rollback === "outer") {
          await expect(outer).rejects.toThrow("Outer rollback");
        } else {
          await outer;
        }
        const admin = orm.em.fork();
        admin.clearSessionContext();
        expect(await admin.count(ApiKey, key.id)).toBe(
          rollback === "none" ? 0 : 1,
        );
        expect(context.apiKey).toBe(rollback === "none" ? null : identity);
      });
    },
  );

  it.each([false, true])(
    "handles explicit begin/commit and rollback without leaking an uncommitted identity (rollback=%s)",
    async (rollback) => {
      await inRequest(async ({ em, key }) => {
        const identity = context.apiKey;
        await em.begin();
        await keys.revokeUserApiKey(key.id);
        expect(context.apiKey).toBe(identity);
        if (rollback) {
          await em.rollback();
        } else {
          await em.commit();
        }
        expect(Boolean((await readStoredKey(key.id)).revokedAt)).toBe(
          !rollback,
        );
        expect(context.apiKey).toBe(rollback ? identity : null);
        expect(em.getSessionContext()?.role).toBe(
          rollback ? "authenticated" : "anonymous",
        );
      });
    },
  );

  it("isolates a singleton context and its RLS scopes across concurrent requests", async () => {
    let markOtherReady!: () => void;
    let markFirstCleared!: () => void;
    const otherReady = new Promise<void>((resolve) => {
      markOtherReady = resolve;
    });
    const firstCleared = new Promise<void>((resolve) => {
      markFirstCleared = resolve;
    });
    const first = orm.em.fork();
    const second = orm.em.fork();
    await Promise.all([
      RequestContext.run(new RequestContext({ type: "test" }), async () => {
        RequestContext.set(EntityManager, first);
        context.initialize({
          user: Object.assign(new User(), { id: "first", roles: ["admin"] }),
        });
        await otherReady;
        expect(context.user?.id).toBe("first");
        context.clear();
        markFirstCleared();
        expect(first.getSessionContext()?.role).toBe("anonymous");
      }),
      RequestContext.run(new RequestContext({ type: "test" }), async () => {
        RequestContext.set(EntityManager, second);
        context.initialize({
          user: Object.assign(new User(), { id: "second", roles: ["admin"] }),
        });
        markOtherReady();
        await firstCleared;
        expect(context.user?.id).toBe("second");
        expect(second.getSessionContext()?.role).toBe("authenticated");
        expect(second.getSessionContext()?.variables?.["app.user.id"]).toBe(
          "second",
        );
      }),
    ]);
  });
  it("does not publish a finished child context's changes into its parent after commit", async () => {
    await inRequest(async ({ em, key }) => {
      const identity = context.apiKey;
      await em.transactional(async () => {
        await RequestContext.child(async () => {
          await keys.updateUserApiKey(key.id, { name: "Child change" });
          expect(context.apiKey).toBe(identity);
        });
      });
      expect((await readStoredKey(key.id)).name).toBe("Child change");
      expect(context.apiKey).toBe(identity);
      expect(context.apiKey?.name).toBe("Original");
    });
  });
});
