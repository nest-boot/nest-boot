import { randomUUID } from "node:crypto";

import { MikroORM } from "@mikro-orm/pglite";
import { getDatabaseConfig } from "@nest-boot/database";

import { createAuthInstance } from "../src/core/create-auth-instance.js";
import { UserDeletionService } from "../src/core/services/user-deletion.service.js";
import { entities, User } from "../src/index.js";
import { createTestAuthContext } from "./fixtures/auth-context.fixture.js";

describe("username validation through Better Auth HTTP endpoints", () => {
  let orm: MikroORM;
  let auth: ReturnType<typeof createAuthInstance>;
  let cookie: string;
  let userId: string;
  let options: Parameters<typeof createAuthInstance>[0];
  const password = "valid-test-password";
  const baseURL = "http://localhost:4100";

  /**
   * Sends a real HTTP request through the configured Better Auth handler.
   * @param path - Auth endpoint path relative to its base path.
   * @param body - JSON payload submitted to the endpoint.
   * @param sessionCookie - Optional authenticated session cookie.
   * @param instance - Auth handler instance to exercise.
   * @returns HTTP response from the configured handler.
   */
  function post(
    path: string,
    body: object,
    sessionCookie?: string,
    instance = auth,
  ) {
    return instance.handler(
      new Request(`${baseURL}/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(sessionCookie ? { cookie: sessionCookie } : {}),
        },
        body: JSON.stringify(body),
      }),
    );
  }

  beforeAll(async () => {
    const { metadataProvider } = await getDatabaseConfig();
    orm = await MikroORM.init({
      metadataProvider,
      metadataCache: { enabled: false },
      dbName: "memory://",
      entities,
    });
    for (const role of ["anonymous", "authenticated"]) {
      await orm.em.execute(`create role ${role} nologin`);
    }
    await orm.schema.create();
    options = {
      baseURL,
      secret:
        "username-integration-secret-with-more-than-thirty-two-characters",
      emailAndPassword: {
        requireEmailVerification: false,
        password: {
          hash: (value: string) => Promise.resolve(`test:${value}`),
          verify: ({ hash, password }: { hash: string; password: string }) =>
            Promise.resolve(hash === `test:${password}`),
        },
      },
    };
    auth = createAuthInstance(
      options,
      orm,
      { sendMail: vi.fn() } as never,
      {} as never,
      new UserDeletionService(orm.em),
      createTestAuthContext(orm.em, options),
    );
    const response = await post("/sign-up/email", {
      email: "owner@example.test",
      name: "Username owner",
      username: "existing-user",
      password,
    });
    expect(response.status).toBe(200);
    userId = (await response.json()).user.id;
    cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  });

  afterAll(async () => {
    await orm?.close();
  });

  it.each([0, false, 42, true, [], {}])(
    "rejects a non-string username %j without changing persistence",
    async (username) => {
      const email = `${randomUUID()}@example.test`;
      const signup = await post("/sign-up/email", {
        email,
        name: "Invalid signup",
        password,
        username,
      });
      expect(signup.status).toBe(400);
      expect(await signup.json()).toMatchObject({ code: "INVALID_USERNAME" });
      expect(await orm.em.fork().findOne(User, { email })).toBeNull();

      const update = await post(
        "/update-user",
        { username, name: "Must not be saved" },
        cookie,
      );
      expect(update.status).toBe(400);
      expect(await update.json()).toMatchObject({ code: "INVALID_USERNAME" });
      expect(await orm.em.fork().findOneOrFail(User, userId)).toMatchObject({
        name: "Username owner",
        username: "existing-user",
      });
    },
  );

  it.each(["", " ", "ab", "a".repeat(31), "Alice", "alice--team"])(
    "rejects invalid string usernames %j on signup and update",
    async (username) => {
      const signup = await post("/sign-up/email", {
        email: `${randomUUID()}@example.test`,
        name: "Invalid signup",
        password,
        username,
      });
      expect(signup.status).toBe(400);
      const update = await post("/update-user", { username }, cookie);
      expect(update.status).toBe(400);
    },
  );

  it.each(["existing-user", "Invalid display name"])(
    "ignores the disabled displayUsername %j and leaves username unassigned",
    async (displayUsername) => {
      const response = await post("/sign-up/email", {
        email: `${randomUUID()}@example.test`,
        name: "Generated username",
        password,
        displayUsername,
      });
      expect(response.status).toBe(200);
      const { user } = await response.json();
      expect(user.username).toBeNull();
      expect((await orm.em.fork().findOneOrFail(User, user.id)).username).toBe(
        user.username,
      );
      expect(user).not.toHaveProperty("displayUsername");
    },
  );

  it("trims maximum-length usernames consistently on all four HTTP routes", async () => {
    const username = "a".repeat(30);
    const padded = `  ${username}  `;
    const available = await post("/is-username-available", {
      username: padded,
    });
    expect(available.status).toBe(200);
    expect(await available.json()).toEqual({ available: true });

    const signup = await post("/sign-up/email", {
      email: "normalized@example.test",
      name: "Normalized user",
      password,
      username: padded,
      displayUsername: "ignored-display-name",
    });
    expect(signup.status).toBe(200);
    expect((await signup.json()).user.username).toBe(username);

    const taken = await post("/is-username-available", { username: padded });
    expect(taken.status).toBe(200);
    expect(await taken.json()).toEqual({ available: false });
    const signin = await post("/sign-in/username", {
      username: padded,
      password,
    });
    expect(signin.status).toBe(200);
    expect((await signin.json()).user.username).toBe(username);

    const updatedUsername = `${"a".repeat(29)}b`;
    const update = await post(
      "/update-user",
      { username: ` ${updatedUsername} ` },
      cookie,
    );
    expect(update.status).toBe(200);
    expect((await orm.em.fork().findOneOrFail(User, userId)).username).toBe(
      updatedUsername,
    );
  });

  it("leaves usernames unassigned when signup omits them or explicitly supplies null", async () => {
    for (const username of [undefined, null]) {
      const response = await post("/sign-up/email", {
        email: `${randomUUID()}@example.test`,
        name: "Optional username",
        password,
        username,
      });
      expect(response.status).toBe(200);
      const { user } = await response.json();
      expect(user.username).toBeNull();
      expect((await orm.em.fork().findOneOrFail(User, user.id)).username).toBe(
        user.username,
      );
    }
  });

  it("leaves usernames unassigned through OAuth and direct ORM creation", async () => {
    const context = await auth.$context;
    const user = await context.internalAdapter.createUser({
      name: "Provider user",
      email: "provider@example.test",
      emailVerified: true,
    });
    expect(
      (await orm.em.fork().findOneOrFail(User, user.id)).username,
    ).toBeNull();
    const em = orm.em.fork();
    const direct = em.create(User, {
      name: "ORM user",
      email: "orm@example.test",
      emailVerified: true,
    });
    await em.persist(direct).flush();
    expect(direct.username).toBeNull();
  });

  it("returns null usernames for both real and synthetic verification-gated signup", async () => {
    const gatedOptions = {
      ...options,
      emailAndPassword: {
        ...options.emailAndPassword,
        requireEmailVerification: true,
      },
    };
    const gated = createAuthInstance(
      gatedOptions,
      orm,
      { sendMail: vi.fn() } as never,
      {} as never,
      new UserDeletionService(orm.em),
      createTestAuthContext(orm.em, gatedOptions),
    );
    const body = {
      email: `${randomUUID()}@example.test`,
      name: "Verification user",
      password,
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await post("/sign-up/email", body, undefined, gated);
      expect(response.status).toBe(200);
      expect((await response.json()).user.username).toBeNull();
    }
  });

  it("rejects null usernames on sign-in and availability endpoints", async () => {
    for (const path of ["/sign-in/username", "/is-username-available"]) {
      expect((await post(path, { username: null, password })).status).toBe(422);
    }
  });

  it("preserves an omitted username and allows clearing and reclaiming a handle", async () => {
    const before = await orm.em.fork().findOneOrFail(User, userId);
    const update = await post(
      "/update-user",
      { name: "New display name" },
      cookie,
    );
    expect(update.status).toBe(200);
    expect(await orm.em.fork().findOneOrFail(User, userId)).toMatchObject({
      name: "New display name",
      username: before.username,
    });
    const clear = await post("/update-user", { username: null }, cookie);
    expect(clear.status).toBe(200);
    expect(
      (await orm.em.fork().findOneOrFail(User, userId)).username,
    ).toBeNull();
    const available = await post("/is-username-available", {
      username: before.username,
    });
    expect(await available.json()).toEqual({ available: true });
    const reclaimed = await post("/sign-up/email", {
      email: `${randomUUID()}@example.test`,
      name: "Reclaimed handle",
      password,
      username: before.username,
    });
    expect(reclaimed.status).toBe(200);
  });
});
