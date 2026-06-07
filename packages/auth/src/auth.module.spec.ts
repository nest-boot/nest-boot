import { MikroORM } from "@mikro-orm/core";
import { MiddlewareManager } from "@nest-boot/middleware";
import { RequestContextMiddleware } from "@nest-boot/request-context";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";

const mockBetterAuth = jest.fn((options) => ({
  api: {},
  options,
}));
const mockToNodeHandler = jest.fn((auth) => ({
  auth,
  type: "node-handler",
}));
const mockMikroOrmAdapter = jest.fn((options) => ({
  options,
  type: "mikro-orm-adapter",
}));
const mockGenericOAuth = jest.fn((options) => ({
  options,
  type: "generic-oauth",
}));

jest.mock("better-auth", () => ({
  betterAuth: mockBetterAuth,
}));
jest.mock("better-auth/node", () => ({
  toNodeHandler: mockToNodeHandler,
}));
jest.mock("better-auth/plugins", () => ({
  genericOAuth: mockGenericOAuth,
}));
jest.mock("./adapters/mikro-orm-adapter", () => ({
  mikroOrmAdapter: mockMikroOrmAdapter,
}));

import { AUTH_TOKEN } from "./auth.constants";
import { AuthMiddleware } from "./auth.middleware";
import { AuthModule } from "./auth.module";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition";

class Account {}
class Session {}
class User {}
class Verification {}

const entities = {
  account: Account,
  session: Session,
  user: User,
  verification: Verification,
};

function setOidcEnv() {
  process.env.AUTH_OIDC_ENABLED = "true";
  process.env.AUTH_OIDC_CLIENT_ID = "oidc-client-id";
  process.env.AUTH_OIDC_CLIENT_SECRET = "oidc-client-secret";
  process.env.AUTH_OIDC_DISCOVERY_URL =
    "https://oidc.example.com/.well-known/openid-configuration";
}

function setGoogleEnv() {
  process.env.AUTH_GOOGLE_ENABLED = "true";
  process.env.AUTH_GOOGLE_CLIENT_ID = "google-client-id";
  process.env.AUTH_GOOGLE_CLIENT_SECRET = "google-client-secret";
}

function setGithubEnv() {
  process.env.AUTH_GITHUB_ENABLED = "true";
  process.env.AUTH_GITHUB_CLIENT_ID = "github-client-id";
  process.env.AUTH_GITHUB_CLIENT_SECRET = "github-client-secret";
}

function getAuthProvider() {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    AuthModule,
  ) as any[];

  return providers.find((provider) => provider.provide === AUTH_TOKEN);
}

function createMiddlewareManager() {
  const authProxy = {
    disableGlobalExcludeRoutes: jest.fn(),
    forRoutes: jest.fn(),
  };
  const middlewareProxy = {
    dependencies: jest.fn(),
    exclude: jest.fn(),
    forRoutes: jest.fn(),
  };
  authProxy.disableGlobalExcludeRoutes.mockReturnValue(authProxy);
  authProxy.forRoutes.mockReturnValue(authProxy);
  middlewareProxy.dependencies.mockReturnValue(middlewareProxy);
  middlewareProxy.exclude.mockReturnValue(middlewareProxy);
  middlewareProxy.forRoutes.mockReturnValue(middlewareProxy);
  const middlewareManager = {
    apply: jest.fn((middleware) =>
      middleware instanceof AuthMiddleware ? middlewareProxy : authProxy,
    ),
    globalExclude: jest.fn(),
  };

  return {
    authProxy,
    middlewareManager,
    middlewareProxy,
  };
}

async function createAuthModule(
  auth: unknown,
  options: unknown,
  middlewareManager: unknown,
  authMiddleware: AuthMiddleware,
) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthModule,
      {
        provide: AUTH_TOKEN,
        useValue: auth,
      },
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: options,
      },
      {
        provide: MiddlewareManager,
        useValue: middlewareManager,
      },
      {
        provide: AuthMiddleware,
        useValue: authMiddleware,
      },
    ],
  }).compile();

  return moduleRef.get(AuthModule);
}

describe("AuthModule", () => {
  const secret =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_abcdefghijklmnopqrstuvwxyz";

  beforeEach(() => {
    mockBetterAuth.mockClear();
    mockGenericOAuth.mockClear();
    mockMikroOrmAdapter.mockClear();
    mockToNodeHandler.mockClear();
    delete process.env.APP_NAME;
    delete process.env.APP_SECRET;
    delete process.env.AUTH_SECRET;
    delete process.env.AUTH_DISABLE_SIGN_UP;
    delete process.env.AUTH_EMAIL_ENABLED;
    delete process.env.AUTH_EMAIL_DISABLE_SIGN_UP;
    delete process.env.AUTH_GITHUB_CLIENT_ID;
    delete process.env.AUTH_GITHUB_CLIENT_SECRET;
    delete process.env.AUTH_GITHUB_DISABLE_SIGN_UP;
    delete process.env.AUTH_GITHUB_ENABLED;
    delete process.env.AUTH_GOOGLE_CLIENT_ID;
    delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
    delete process.env.AUTH_GOOGLE_DISABLE_SIGN_UP;
    delete process.env.AUTH_GOOGLE_ENABLED;
    delete process.env.AUTH_OIDC_CLIENT_ID;
    delete process.env.AUTH_OIDC_CLIENT_SECRET;
    delete process.env.AUTH_OIDC_DISCOVERY_URL;
    delete process.env.AUTH_OIDC_DISABLE_SIGN_UP;
    delete process.env.AUTH_OIDC_ENABLED;
    delete process.env.AUTH_OIDC_PROMPT;
    delete process.env.AUTH_OIDC_SCOPES;
    delete process.env.APP_URL;
    delete process.env.AUTH_URL;
  });

  it("should register synchronous options", () => {
    const options = {
      entities,
      secret,
    };
    const dynamicModule = AuthModule.forRoot(options as never);

    expect(dynamicModule.module).toBe(AuthModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
      ]),
    );
  });

  it("should register asynchronous options", () => {
    const useFactory = () => ({
      entities,
      secret,
    });
    const dynamicModule = AuthModule.forRootAsync({
      useFactory,
    } as never);

    expect(dynamicModule.module).toBe(AuthModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          inject: [],
          provide: MODULE_OPTIONS_TOKEN,
          useFactory,
        },
      ]),
    );
  });

  it("should create better-auth with validated options and MikroORM adapter", () => {
    process.env.AUTH_URL = "https://auth.example.com";
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    const auth = authProvider.useFactory(
      {
        entities,
        secret,
      },
      orm,
    );

    expect(auth).toEqual({
      api: {},
      options: expect.any(Object),
    });
    expect(mockMikroOrmAdapter).toHaveBeenCalledWith({
      entities,
      orm,
    });
    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        account: {
          skipStateCookieCheck: true,
        },
        baseURL: "https://auth.example.com",
        database: {
          options: {
            entities,
            orm,
          },
          type: "mikro-orm-adapter",
        },
        entities,
        secret,
      }),
    );
  });

  it("should disable email and OIDC signup when the global signup disable flag is enabled", () => {
    process.env.AUTH_DISABLE_SIGN_UP = "true";
    process.env.AUTH_EMAIL_ENABLED = "true";
    setGithubEnv();
    setGoogleEnv();
    setOidcEnv();
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        secret,
      },
      orm,
    );

    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAndPassword: expect.objectContaining({
          disableSignUp: true,
        }),
        socialProviders: {
          github: expect.objectContaining({
            disableSignUp: true,
          }),
          google: expect.objectContaining({
            disableSignUp: true,
          }),
        },
      }),
    );
    expect(mockGenericOAuth).toHaveBeenCalledWith({
      config: [
        expect.objectContaining({
          disableSignUp: true,
          providerId: "oidc",
        }),
      ],
    });
  });

  it("should create dedicated Google and GitHub social providers from env", () => {
    setGithubEnv();
    setGoogleEnv();
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        secret,
      },
      orm,
    );

    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        socialProviders: {
          github: {
            clientId: "github-client-id",
            clientSecret: "github-client-secret",
            disableSignUp: false,
            enabled: true,
          },
          google: {
            clientId: "google-client-id",
            clientSecret: "google-client-secret",
            disableSignUp: false,
            enabled: true,
          },
        },
      }),
    );
    expect(mockGenericOAuth).not.toHaveBeenCalled();
  });

  it("should disable signup for provider-specific social provider flags", () => {
    process.env.AUTH_GITHUB_DISABLE_SIGN_UP = "true";
    process.env.AUTH_GOOGLE_DISABLE_SIGN_UP = "true";
    setGithubEnv();
    setGoogleEnv();
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        secret,
      },
      orm,
    );

    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        socialProviders: {
          github: expect.objectContaining({
            disableSignUp: true,
          }),
          google: expect.objectContaining({
            disableSignUp: true,
          }),
        },
      }),
    );
  });

  it("should apply provider-specific social provider enabled flags", () => {
    setGoogleEnv();
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        secret,
      },
      orm,
    );

    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        socialProviders: {
          google: expect.objectContaining({
            enabled: true,
          }),
        },
      }),
    );
  });

  it("should disable manually configured social providers when provider enabled env is false", () => {
    process.env.AUTH_GITHUB_ENABLED = "false";
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        secret,
        socialProviders: {
          github: {
            clientId: "github-client-id",
            clientSecret: "github-client-secret",
            enabled: true,
          },
        },
      },
      orm,
    );

    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        socialProviders: {
          github: {
            clientId: "github-client-id",
            clientSecret: "github-client-secret",
            enabled: false,
          },
        },
      }),
    );
  });

  it.each([
    ["AUTH_GOOGLE_CLIENT_ID", setGoogleEnv],
    ["AUTH_GOOGLE_CLIENT_SECRET", setGoogleEnv],
    ["AUTH_GITHUB_CLIENT_ID", setGithubEnv],
    ["AUTH_GITHUB_CLIENT_SECRET", setGithubEnv],
  ])(
    "should reject missing %s when social provider env is configured",
    (envName, setEnv) => {
      setEnv();
      process.env[envName] = "";
      const orm = {
        em: {},
      } as unknown as MikroORM;
      const authProvider = getAuthProvider();

      expect(() =>
        authProvider.useFactory(
          {
            entities,
            secret,
          },
          orm,
        ),
      ).toThrow(envName);
    },
  );

  it("should keep signup enabled when the global signup disable flag is not true", () => {
    process.env.AUTH_DISABLE_SIGN_UP = "false";
    setOidcEnv();
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        secret,
      },
      orm,
    );

    expect(mockGenericOAuth).toHaveBeenCalledWith({
      config: [
        expect.objectContaining({
          disableSignUp: false,
          providerId: "oidc",
        }),
      ],
    });
  });

  it("should skip OIDC plugin registration when OIDC env is not configured", () => {
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        secret,
      },
      orm,
    );

    expect(mockGenericOAuth).not.toHaveBeenCalled();
  });

  it("should skip OIDC plugin registration when OIDC credentials are configured but AUTH_OIDC_ENABLED is unset", () => {
    process.env.AUTH_OIDC_CLIENT_ID = "oidc-client-id";
    process.env.AUTH_OIDC_CLIENT_SECRET = "oidc-client-secret";
    process.env.AUTH_OIDC_DISCOVERY_URL =
      "https://oidc.example.com/.well-known/openid-configuration";
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        secret,
      },
      orm,
    );

    expect(mockGenericOAuth).not.toHaveBeenCalled();
  });

  it.each([
    ["AUTH_OIDC_CLIENT_ID"],
    ["AUTH_OIDC_CLIENT_SECRET"],
    ["AUTH_OIDC_DISCOVERY_URL"],
  ])("should reject missing %s when OIDC env is configured", (envName) => {
    setOidcEnv();
    process.env[envName] = "";
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    expect(() =>
      authProvider.useFactory(
        {
          entities,
          secret,
        },
        orm,
      ),
    ).toThrow(envName);
  });

  it("should reject invalid OIDC prompt values", () => {
    setOidcEnv();
    process.env.AUTH_OIDC_PROMPT = "invalid";
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    expect(() =>
      authProvider.useFactory(
        {
          entities,
          secret,
        },
        orm,
      ),
    ).toThrow("AUTH_OIDC_PROMPT");
  });

  it("should keep env OIDC plugin when custom plugins are configured", () => {
    setOidcEnv();
    const customPlugin = {
      id: "custom-plugin",
    };
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        plugins: [customPlugin],
        secret,
      },
      orm,
    );

    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: [
          {
            options: {
              config: [
                expect.objectContaining({
                  providerId: "oidc",
                }),
              ],
            },
            type: "generic-oauth",
          },
          customPlugin,
        ],
      }),
    );
  });

  it("should reject env OIDC when a custom genericOAuth plugin is configured", () => {
    setOidcEnv();
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    expect(() =>
      authProvider.useFactory(
        {
          entities,
          plugins: [
            {
              id: "generic-oauth",
            },
          ],
          secret,
        },
        orm,
      ),
    ).toThrow("AUTH_OIDC_*");
  });

  it("should merge email auth options without dropping env signup disable flags", () => {
    process.env.AUTH_DISABLE_SIGN_UP = "true";
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        emailAndPassword: {
          enabled: true,
          maxPasswordLength: 128,
        },
        entities,
        secret,
      },
      orm,
    );

    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAndPassword: {
          disableSignUp: true,
          enabled: true,
          maxPasswordLength: 128,
        },
      }),
    );
  });

  it("should merge social provider options without dropping env signup disable flags", () => {
    process.env.AUTH_DISABLE_SIGN_UP = "true";
    const orm = {
      em: {},
    } as unknown as MikroORM;
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        secret,
        socialProviders: {
          apple: {
            clientId: "apple-client-id",
            clientSecret: "apple-client-secret",
          },
          google: {
            clientId: "google-client-id",
            clientSecret: "google-client-secret",
            scope: ["email"],
          },
        },
      },
      orm,
    );

    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        socialProviders: {
          apple: {
            clientId: "apple-client-id",
            clientSecret: "apple-client-secret",
          },
          google: {
            clientId: "google-client-id",
            clientSecret: "google-client-secret",
            disableSignUp: true,
            scope: ["email"],
          },
        },
      }),
    );
  });

  it("should reject missing, short, or low-entropy secrets", () => {
    const authProvider = getAuthProvider();
    const orm = {
      em: {},
    } as unknown as MikroORM;

    expect(() =>
      authProvider.useFactory(
        {
          entities,
        },
        orm,
      ),
    ).toThrow("Auth secret is required");
    expect(() =>
      authProvider.useFactory(
        {
          entities,
          secret: "short",
        },
        orm,
      ),
    ).toThrow("Auth secret must be at least 32 characters long");
    expect(() =>
      authProvider.useFactory(
        {
          entities,
          secret: "a".repeat(32),
        },
        orm,
      ),
    ).toThrow("Auth secret appears low-entropy");
  });

  it("should register auth handler and auth middleware routes", async () => {
    const auth = {
      api: {},
    };
    const authMiddleware = {} as AuthMiddleware;
    Object.setPrototypeOf(authMiddleware, AuthMiddleware.prototype);
    const { authProxy, middlewareManager, middlewareProxy } =
      createMiddlewareManager();

    await createAuthModule(
      auth as never,
      {
        basePath: "/auth",
        entities,
        middleware: {
          excludeRoutes: ["/public"],
          includeRoutes: ["/private"],
        },
      } as never,
      middlewareManager as never,
      authMiddleware,
    );

    expect(middlewareManager.globalExclude).toHaveBeenCalledWith("/auth");
    expect(mockToNodeHandler).toHaveBeenCalledWith(auth);
    expect(middlewareManager.apply).toHaveBeenCalledWith({
      auth,
      type: "node-handler",
    });
    expect(authProxy.disableGlobalExcludeRoutes).toHaveBeenCalledTimes(1);
    expect(authProxy.forRoutes).toHaveBeenCalledWith("/auth");
    expect(middlewareManager.apply).toHaveBeenCalledWith(authMiddleware);
    expect(middlewareProxy.dependencies).toHaveBeenCalledWith(
      RequestContextMiddleware,
    );
    expect(middlewareProxy.exclude).toHaveBeenCalledWith("/public");
    expect(middlewareProxy.forRoutes).toHaveBeenCalledWith("/private");
  });

  it("should use defaults and skip auth middleware registration when disabled", async () => {
    const auth = {
      api: {},
    };
    const authMiddleware = {} as AuthMiddleware;
    Object.setPrototypeOf(authMiddleware, AuthMiddleware.prototype);
    const { authProxy, middlewareManager, middlewareProxy } =
      createMiddlewareManager();

    await createAuthModule(
      auth as never,
      {
        entities,
        middleware: {
          register: false,
        },
      } as never,
      middlewareManager as never,
      authMiddleware,
    );

    expect(middlewareManager.globalExclude).toHaveBeenCalledWith("/api/auth/");
    expect(authProxy.forRoutes).toHaveBeenCalledWith("/api/auth/");
    expect(middlewareProxy.dependencies).not.toHaveBeenCalled();
  });
});
