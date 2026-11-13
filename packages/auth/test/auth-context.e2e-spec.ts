import { EntityManager, ref } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/pglite";
import { getDatabaseConfig } from "@nest-boot/database";
import { RequestContext } from "@nest-boot/request-context";
import { BadRequestException } from "@nestjs/common";

import { ApiKey } from "../src/api-key/entities/api-key.entity.js";
import { ApiKeyService } from "../src/api-key/services/api-key.service.js";
import { UserApiKeyService } from "../src/api-key/services/user-api-key.service.js";
import { toApiKeyView } from "../src/api-key/utils/api-key-view.util.js";
import { AuthContext } from "../src/core/auth-context.js";
import { User } from "../src/core/entities/user.entity.js";
import { entities, workspaceEntities } from "../src/index.js";
import { withAuthTestFeatures } from "./fixtures/enabled-auth-features.fixture.js";

const options = withAuthTestFeatures({ workspace: { enabled: true } });

describe("Auth request identity and persistence boundaries", () => {
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
    context = new AuthContext(orm.em, options);
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

  const operations = ["update", "revoke", "delete"] as const;
  type Operation = (typeof operations)[number];

  /**
   * Executes a public mutation against a selected credential.
   * @param operation - Mutation to exercise.
   * @param id - Credential identifier.
   * @returns Public credential metadata.
   */
  function changeKey(operation: Operation, id: string) {
    switch (operation) {
      case "update":
        return keys.updateUserApiKey(id, { permissions: ["user:read"] });
      case "revoke":
        return keys.revokeUserApiKey(id);
      case "delete":
        return keys.deleteUserApiKey(id);
    }
  }

  it.each(
    (["scoped", "base", "savepoint", "manual"] as const).flatMap((mode) =>
      operations.map((operation) => ({ mode, operation })),
    ),
  )(
    "rejects self-$operation before writing in a $mode transaction",
    async ({ mode, operation }) => {
      await inRequest(async ({ em, key, user }) => {
        const identity = context.apiKey;
        if (mode !== "scoped") {
          em.clearSessionContext();
        }
        const scope = em.getSessionContext();
        const denied = async () => {
          await expect(changeKey(operation, key.id)).rejects.toBeInstanceOf(
            BadRequestException,
          );
          expect(context.apiKey).toBe(identity);
          expect(context.user).toBe(user);
        };
        if (mode === "manual") {
          await em.begin();
          try {
            await denied();
          } finally {
            await em.rollback();
          }
        } else {
          await em.transactional(async (tx) => {
            if (mode === "savepoint") {
              await tx.transactional(denied);
            } else {
              await denied();
            }
          });
        }
        expect(await readStoredKey(key.id)).toMatchObject({
          name: "Original",
          revokedAt: null,
          lastUsedAt: null,
          permissions: ["user-api-key:write", "user:read"],
        });
        expect(context.apiKey).toBe(identity);
        expect(em.getSessionContext()).toEqual(scope);
      });
    },
  );

  it.each(operations)(
    "publishes self-%s immediately after successful persistence outside a transaction",
    async (operation) => {
      await inRequest(async ({ em, key, user }) => {
        const identity = context.apiKey;
        const result = await changeKey(operation, key.id);
        expect(result).not.toHaveProperty("key");
        if (operation === "update") {
          expect((await readStoredKey(key.id)).permissions).toEqual([
            "user:read",
          ]);
          expect(context.apiKey).not.toBe(identity);
          expect(context.apiKey?.permissions).toEqual(["user:read"]);
          expect(context.user).toBe(user);
          expect(em.getSessionContext()?.role).toBe("authenticated");
        } else {
          expect(context.apiKey).toBeNull();
          expect(context.user).toBeNull();
          expect(em.getSessionContext()?.role).toBe("anonymous");
          if (operation === "revoke") {
            expect((await readStoredKey(key.id)).revokedAt).toEqual(
              result.revokedAt,
            );
          } else {
            expect(await orm.em.fork().count(ApiKey, key.id)).toBe(0);
          }
        }
      });
    },
  );

  it("allows changing another key in a transaction and preserves identity on rollback", async () => {
    await inRequest(async ({ em, user }) => {
      const other = em.create(ApiKey, {
        owner: ref(User, user),
        name: "Other",
        key: crypto.randomUUID(),
        permissions: ["user:read"],
      });
      await em.persist(other).flush();
      const identity = context.apiKey;
      await expect(
        em.transactional(async () => {
          await keys.updateUserApiKey(other.id, { name: "Rolled back" });
          expect(context.apiKey).toBe(identity);
          throw new Error("Rollback requested");
        }),
      ).rejects.toThrow("Rollback requested");
      expect((await readStoredKey(other.id)).name).toBe("Other");
      expect(context.apiKey).toBe(identity);
    });
  });

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
});
