import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import { Global, type INestApplication, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { betterAuth } from "better-auth";

import { AuthModule } from "../../src/core/auth.module.js";
import { AUTH_TOKEN } from "../../src/core/constants/auth.constants.js";
import type { AuthModuleOptions } from "../../src/core/interfaces/auth-module-options.interface.js";
import { AuthService } from "../../src/core/services/auth.service.js";

@Global()
@Module({
  providers: [
    { provide: Mailer, useValue: { sendMail: vi.fn() } },
    {
      provide: HashService,
      useValue: {
        hash: (value: string) => Promise.resolve(`hashed:${value}`),
        verify: (hash: string, value: string) =>
          Promise.resolve(hash === `hashed:${value}`),
      },
    },
  ],
  exports: [Mailer, HashService],
})
class Infrastructure {}

describe("Auth global prefix", () => {
  let app: INestApplication;

  const upstreamURLVariables = [
    "BETTER_AUTH_URL",
    "NEXT_PUBLIC_BETTER_AUTH_URL",
    "PUBLIC_BETTER_AUTH_URL",
    "NUXT_PUBLIC_BETTER_AUTH_URL",
    "NUXT_PUBLIC_AUTH_URL",
    "BASE_URL",
  ] as const;

  beforeEach(() => {
    for (const name of ["AUTH_URL", "APP_URL", ...upstreamURLVariables]) {
      vi.stubEnv(name, undefined);
    }
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it.each([
    { prefix: undefined, basePath: undefined, path: "/auth", async: false },
    { prefix: "api", basePath: undefined, path: "/api/auth", async: false },
    { prefix: "api", basePath: undefined, path: "/api/auth", async: true },
    {
      prefix: undefined,
      basePath: "/identity",
      path: "/identity",
      async: false,
    },
    {
      prefix: "v2/nested",
      basePath: "/identity",
      path: "/v2/nested/identity",
      async: true,
    },
    {
      prefix: "/v2/",
      basePath: "/identity/",
      path: "/v2/identity",
      async: false,
    },
  ])(
    "mounts $path and configures Better Auth with the same path",
    async ({ prefix, basePath, path, async }) => {
      const url = await createApp({ basePath }, prefix, async);
      const auth = app.get<ReturnType<typeof betterAuth>>(AUTH_TOKEN);
      expect(auth.options.basePath).toBe(path);
      expect((await auth.$context).baseURL).toBe(`http://localhost${path}`);
      expect((await fetch(`${url}${path}/ok`)).status).toBe(200);
      expect((await fetch(`${url}${path}/get-session`)).status).toBe(200);
      if (prefix) {
        expect((await fetch(`${url}${basePath ?? "/auth"}/ok`)).status).toBe(
          404,
        );
        const duplicatePath = `/${prefix.replace(/^\/+|\/+$/g, "")}${path}`;
        expect((await fetch(`${url}${duplicatePath}/ok`)).status).toBe(404);
      } else if (!basePath) {
        expect((await fetch(`${url}/api/auth/ok`)).status).toBe(404);
      }
    },
  );

  it("honors a global prefix exclusion for the auth subtree", async () => {
    const url = await createApp({}, "api", false, ["auth", "auth/{*path}"]);
    const auth = app.get<ReturnType<typeof betterAuth>>(AUTH_TOKEN);
    expect(auth.options.basePath).toBe("/auth");
    expect((await fetch(`${url}/auth/ok`)).status).toBe(200);
    expect((await fetch(`${url}/api/auth/ok`)).status).toBe(404);
  });

  it("matches middleware exclusions before trimming the route's trailing slash", async () => {
    const url = await createApp({ basePath: "/identity/" }, "api", false, [
      "identity/{*path}",
    ]);
    const auth = app.get<ReturnType<typeof betterAuth>>(AUTH_TOKEN);
    expect(auth.options.basePath).toBe("/identity");
    expect((await fetch(`${url}/identity/ok`)).status).toBe(200);
    expect((await fetch(`${url}/api/identity/ok`)).status).toBe(404);
  });

  it.each(["http://localhost/api/auth", "http://localhost/api/auth/"])(
    "accepts a matching full public auth URL: %s",
    async (baseURL) => {
      const url = await createApp({ baseURL }, "api");
      const auth = app.get<ReturnType<typeof betterAuth>>(AUTH_TOKEN);
      expect((await auth.$context).baseURL).toBe("http://localhost/api/auth");
      expect((await fetch(`${url}/api/auth/ok`)).status).toBe(200);
    },
  );

  it.each(["http://localhost", "http://localhost/api/auth"])(
    "keeps the final mount after an early public service read with baseURL %s",
    async (baseURL) => {
      const url = await createApp(
        { baseURL },
        "api",
        false,
        [],
        async (app) => {
          expect(await app.get(AuthService).listSocialProviders()).toEqual([
            expect.objectContaining({ id: "github" }),
          ]);
        },
      );
      const auth = app.get<ReturnType<typeof betterAuth>>(AUTH_TOKEN);
      expect((await auth.$context).baseURL).toBe("http://localhost/api/auth");
      expect((await fetch(`${url}/api/auth/ok`)).status).toBe(200);
      expect((await fetch(`${url}/auth/ok`)).status).toBe(404);
    },
  );

  it.each(["options", "AUTH_URL", "APP_URL"] as const)(
    "preserves request-derived URLs when %s is empty",
    async (source) => {
      vi.stubEnv("AUTH_URL", source === "AUTH_URL" ? "" : undefined);
      vi.stubEnv("APP_URL", source === "APP_URL" ? "" : undefined);
      vi.stubEnv("BETTER_AUTH_URL", undefined);
      const url = await createApp(
        { baseURL: source === "options" ? "" : undefined },
        "api",
      );
      expect((await fetch(`${url}/api/auth/ok`)).status).toBe(200);
      expect((await fetch(`${url}/api/auth/get-session`)).status).toBe(200);
    },
  );

  it.each(upstreamURLVariables)(
    "rejects an inherited %s pathname that conflicts with the mount",
    async (name) => {
      vi.stubEnv(name, "http://localhost/api/auth");
      await expect(createApp({ baseURL: undefined })).rejects.toThrow(
        /baseURL.*pathname.*basePath/i,
      );
    },
  );

  it.each(upstreamURLVariables)(
    "uses the inherited %s origin with the global prefix",
    async (name) => {
      vi.stubEnv(name, "http://localhost");
      const url = await createApp({ baseURL: undefined }, "api");
      const auth = app.get<ReturnType<typeof betterAuth>>(AUTH_TOKEN);
      expect(auth.options.baseURL).toBe("http://localhost");
      expect((await auth.$context).baseURL).toBe("http://localhost/api/auth");
      expect((await fetch(`${url}/api/auth/get-session`)).status).toBe(200);
    },
  );

  it("normalizes an inherited full auth URL before creating the backend", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost/api/auth/");
    const url = await createApp({ baseURL: undefined }, "api");
    const auth = app.get<ReturnType<typeof betterAuth>>(AUTH_TOKEN);
    expect((await auth.$context).baseURL).toBe("http://localhost/api/auth");
    expect((await fetch(`${url}/api/auth/ok`)).status).toBe(200);
  });

  it.each(["options", "AUTH_URL", "APP_URL"] as const)(
    "keeps %s ahead of the upstream URL fallback",
    async (source) => {
      vi.stubEnv("BETTER_AUTH_URL", "http://localhost/legacy/auth");
      if (source !== "options") {
        vi.stubEnv(source, "http://localhost");
      }
      const url = await createApp(
        { baseURL: source === "options" ? "http://localhost" : undefined },
        "api",
      );
      expect((await fetch(`${url}/api/auth/ok`)).status).toBe(200);
    },
  );

  it("preserves request-derived URLs when upstream BASE_URL is /", async () => {
    vi.stubEnv("BASE_URL", "/");
    const url = await createApp({ baseURL: undefined }, "api");
    expect((await fetch(`${url}/api/auth/ok`)).status).toBe(200);
  });

  it("rejects a conflicting AUTH_URL pathname during startup", async () => {
    vi.stubEnv("AUTH_URL", "http://localhost/api/auth");
    await expect(createApp({ baseURL: undefined })).rejects.toThrow(
      /baseURL.*pathname.*basePath/i,
    );
  });

  it.each([
    { basePath: "/auth", path: "/api/auth" },
    { basePath: "/", path: "/api" },
  ])(
    "uses $path for sign-in, cookies, email, and OAuth callbacks",
    async ({ basePath, path }) => {
      const url = await createApp({ basePath }, "api");
      const orm = app.get<PgliteORM>(MikroORM);
      await orm.em.execute("create role authenticated nologin noinherit");
      await orm.em.execute("create role anonymous nologin noinherit");
      await orm.schema.create();

      const signup = await fetch(`${url}${path}/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Alice",
          email: "alice@example.com",
          password: "valid-password",
        }),
      });
      expect(signup.status).toBe(200);
      const signin = await fetch(`${url}${path}/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alice@example.com",
          password: "valid-password",
        }),
      });
      expect(signin.status).toBe(200);
      const cookie = signin.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(cookie).toContain("session_token=");
      const session = await fetch(`${url}${path}/get-session`, {
        headers: { Cookie: cookie },
      });
      expect(session.status).toBe(200);
      expect(await session.json()).toMatchObject({
        user: { email: "alice@example.com" },
      });

      const sendMail = vi.spyOn(app.get(Mailer), "sendMail");
      const reset = await fetch(`${url}${path}/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@example.com" }),
      });
      expect(reset.status).toBe(200);
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "alice@example.com",
          text: expect.stringContaining(
            `http://localhost${path}/reset-password/`,
          ),
        }),
      );

      const social = await fetch(`${url}${path}/sign-in/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "github", disableRedirect: true }),
      });
      expect(social.status).toBe(200);
      const authorization = (await social.json()) as { url: string };
      expect(new URL(authorization.url).searchParams.get("redirect_uri")).toBe(
        `http://localhost${path}/callback/github`,
      );
    },
  );

  /**
   * Boots the complete auth module before configuring the application prefix.
   * @param overrides - Optional auth configuration overrides
   * @param prefix - Application global prefix
   * @param async - Whether to register options asynchronously
   * @param exclude - Routes to exclude from the global prefix
   * @param beforePrefix - Optional public service access before configuring the prefix
   * @returns Listening application URL
   */
  async function createApp(
    overrides: AuthModuleOptions = {},
    prefix?: string,
    async = false,
    exclude: string[] = [],
    beforePrefix?: (app: INestApplication) => Promise<void>,
  ) {
    const options: AuthModuleOptions = {
      secret:
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
      baseURL: "http://localhost",
      emailAndPassword: { requireEmailVerification: false },
      providers: [
        {
          id: "github",
          clientId: "github-client",
          clientSecret: "github-secret",
        },
      ],
      ...overrides,
    };
    const module = await Test.createTestingModule({
      imports: [
        Infrastructure,
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [],
        }),
        async
          ? AuthModule.forRootAsync({
              useFactory: () => Promise.resolve(options),
            })
          : AuthModule.forRoot(options),
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await beforePrefix?.(app);
    if (prefix) {
      app.setGlobalPrefix(prefix, { exclude });
    }
    await app.listen(0, "127.0.0.1");
    return await app.getUrl();
  }
});
