import { MikroORM } from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import { Mailer } from "@nest-boot/mailer";
import { MiddlewareManager } from "@nest-boot/middleware";
import { RequestContextMiddleware } from "@nest-boot/request-context";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";

const {
  mockBetterAuth,
  mockGenericOAuth,
  mockMikroOrmAdapter,
  mockToNodeHandler,
} = vi.hoisted(() => ({
  mockBetterAuth: vi.fn((options) => ({
    api: {},
    options,
  })),
  mockGenericOAuth: vi.fn((options) => ({
    options,
    type: "generic-oauth",
  })),
  mockMikroOrmAdapter: vi.fn((options) => ({
    options,
    type: "mikro-orm-adapter",
  })),
  mockToNodeHandler: vi.fn((auth) => ({
    auth,
    type: "node-handler",
  })),
}));

vi.mock("better-auth", () => ({
  betterAuth: mockBetterAuth,
}));
vi.mock("better-auth/node", () => ({
  toNodeHandler: mockToNodeHandler,
}));
vi.mock("better-auth/plugins", () => ({
  genericOAuth: mockGenericOAuth,
}));
vi.mock("./adapters/mikro-orm-adapter.js", () => ({
  mikroOrmAdapter: mockMikroOrmAdapter,
}));

import { ApiKeyService } from "./api-key.service.js";
import { AUTH_TOKEN } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMiddleware } from "./auth.middleware.js";
import { AuthModule } from "./auth.module.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import { AuthService } from "./auth.service.js";
import { AuthHandlerMiddleware } from "./auth-handler.middleware.js";
import { SessionService } from "./session.service.js";
import { UserService } from "./user.service.js";
import { WorkspaceService } from "./workspace.service.js";

class Account {}
class ApiKey {}
class Session {}
class User {}
class Verification {}
class Workspace {}
class WorkspaceInvitation {}
class WorkspaceMember {}

const entities = {
  account: Account,
  apiKey: ApiKey,
  session: Session,
  user: User,
  verification: Verification,
  workspace: Workspace,
  workspaceInvitation: WorkspaceInvitation,
  workspaceMember: WorkspaceMember,
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
    disableGlobalExcludeRoutes: vi.fn(),
    forRoutes: vi.fn(),
  };
  const middlewareProxy = {
    after: vi.fn(),
    before: vi.fn(),
    dependencies: vi.fn(),
    exclude: vi.fn(),
    forRoutes: vi.fn(),
  };
  authProxy.disableGlobalExcludeRoutes.mockReturnValue(authProxy);
  authProxy.forRoutes.mockReturnValue(authProxy);
  middlewareProxy.after.mockReturnValue(middlewareProxy);
  middlewareProxy.before.mockReturnValue(middlewareProxy);
  middlewareProxy.dependencies.mockReturnValue(middlewareProxy);
  middlewareProxy.exclude.mockReturnValue(middlewareProxy);
  middlewareProxy.forRoutes.mockReturnValue(middlewareProxy);
  const middlewareManager = {
    apply: vi.fn((middleware) =>
      middleware instanceof AuthHandlerMiddleware ? authProxy : middlewareProxy,
    ),
    globalExclude: vi.fn(),
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
      AuthHandlerMiddleware,
    ],
  }).compile();

  return {
    authModule: moduleRef.get(AuthModule),
    authHandlerMiddleware: moduleRef.get(AuthHandlerMiddleware),
  };
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
    delete process.env.AUTH_EMAIL_REQUIRE_VERIFICATION;
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

  it("provides and exports the combined auth guard", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AuthModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      AuthModule,
    ) as unknown[];

    expect(providers).toContain(AuthGuard);
    expect(providers).toContain(AuthHandlerMiddleware);
    expect(providers).toContain(UserService);
    expect(providers).toContain(ApiKeyService);
    expect(providers).toContain(AuthService);
    expect(providers).toContain(SessionService);
    expect(providers).toContain(WorkspaceService);
    expect(exports).toContain(MODULE_OPTIONS_TOKEN);
    expect(exports).toContain(UserService);
    expect(exports).toContain(ApiKeyService);
    expect(exports).toContain(AuthGuard);
    expect(exports).toContain(AuthService);
    expect(exports).toContain(SessionService);
    expect(exports).toContain(WorkspaceService);
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
    const mailer = {
      sendMail: vi.fn(),
    } as unknown as Mailer;

    const auth = authProvider.useFactory(
      {
        entities,
        secret,
      },
      orm,
      mailer,
    );

    expect(auth).toEqual({
      api: {},
      options: expect.any(Object),
    });
    expect(mockMikroOrmAdapter).toHaveBeenCalledWith({
      defaultUserRole: "user",
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
            defaultUserRole: "user",
            entities,
            orm,
          },
          type: "mikro-orm-adapter",
        },
        secret,
      }),
    );
    expect(mockBetterAuth.mock.calls[0]?.[0]).not.toHaveProperty("entities");
    expect(authProvider.inject).toEqual([
      MODULE_OPTIONS_TOKEN,
      MikroORM,
      Mailer,
      HashService,
    ]);
  });

  it.each([
    [
      "user",
      {
        user: {
          permissions: ["user:list"],
          roles: { admin: ["user:delete"] },
        },
      },
      'Role "admin" contains unknown user permissions: user:delete',
    ],
    [
      "workspace",
      {
        workspace: {
          permissions: ["workspace:update"],
          roles: { owner: ["workspace:delete"] },
        },
      },
      'Role "owner" contains unknown workspace permissions: workspace:delete',
    ],
  ])(
    "rejects %s roles outside their permission catalog",
    (_, config, error) => {
      const authProvider = getAuthProvider();

      expect(() =>
        authProvider.useFactory({ entities, secret, ...config }, {
          em: {},
        } as unknown as MikroORM),
      ).toThrow(error);
      expect(mockBetterAuth).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "user defaultRole",
      {
        user: {
          defaultRole: "customer",
          permissions: [],
          roles: { user: [] },
        },
      },
      'user.defaultRole references unknown role "customer"',
    ],
    [
      "user adminRoles",
      {
        user: {
          adminRoles: ["administrator"],
          permissions: [],
          roles: { admin: [], user: [] },
        },
      },
      'user.adminRoles references unknown role "administrator"',
    ],
    [
      "workspace defaultRole",
      {
        workspace: {
          defaultRole: "viewer",
          permissions: [],
          roles: { member: [], owner: [] },
        },
      },
      'workspace.defaultRole references unknown role "viewer"',
    ],
    [
      "workspace creatorRole",
      {
        workspace: {
          creatorRole: "creator",
          permissions: [],
          roles: { member: [], owner: [] },
        },
      },
      'workspace.creatorRole references unknown role "creator"',
    ],
  ])("rejects an unknown %s", (_, config, error) => {
    const authProvider = getAuthProvider();

    expect(() =>
      authProvider.useFactory({ entities, secret, ...config }, {
        em: {},
      } as unknown as MikroORM),
    ).toThrow(error);
    expect(mockBetterAuth).not.toHaveBeenCalled();
  });

  it("should merge account options with the module OAuth state default", () => {
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        account: {
          updateAccountOnSignIn: false,
        },
        entities,
        secret,
      },
      { em: {} } as unknown as MikroORM,
    );

    expect(mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        account: {
          skipStateCookieCheck: true,
          updateAccountOnSignIn: false,
        },
      }),
    );
  });

  it("should send verification emails through the injected mailer", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        secret,
      },
      { em: {} } as unknown as MikroORM,
      { sendMail } as unknown as Mailer,
    );

    await mockBetterAuth.mock.calls[0]?.[0].emailVerification.sendVerificationEmail(
      {
        token: "verification-token",
        url: "https://app.example.com/verify-email",
        user: {
          email: "user@example.com",
        },
      },
      undefined,
    );

    expect(sendMail).toHaveBeenCalledWith({
      subject: "Verify your email address",
      text: "Click the link to verify your email: https://app.example.com/verify-email",
      to: "user@example.com",
    });
  });

  it("should not pass Nest module extensions to better-auth", () => {
    const authProvider = getAuthProvider();

    authProvider.useFactory(
      {
        entities,
        middleware: { register: false },
        onAuthenticated: vi.fn(),
        secret,
        unexpectedOption: "must-not-pass-through",
        user: { buildAbility: vi.fn(), modelName: "application_user" },
        workspace: {
          buildAbility: vi.fn(),
          sendInvitationEmail: vi.fn(),
        },
      },
      { em: {} } as unknown as MikroORM,
    );

    expect(mockBetterAuth.mock.calls[0]?.[0].user).not.toHaveProperty(
      "buildAbility",
    );
    expect(mockBetterAuth.mock.calls[0]?.[0].user).toEqual({
      modelName: "application_user",
    });
    expect(mockBetterAuth.mock.calls[0]?.[0]).not.toHaveProperty("entities");
    expect(mockBetterAuth.mock.calls[0]?.[0]).not.toHaveProperty("middleware");
    expect(mockBetterAuth.mock.calls[0]?.[0]).not.toHaveProperty(
      "onAuthenticated",
    );
    expect(mockBetterAuth.mock.calls[0]?.[0]).not.toHaveProperty("workspace");
    expect(mockBetterAuth.mock.calls[0]?.[0]).not.toHaveProperty(
      "unexpectedOption",
    );
  });

  it("should enable email auth by default when AUTH_EMAIL_ENABLED is unset", () => {
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
        emailAndPassword: {
          disableSignUp: false,
          enabled: true,
          password: {
            hash: expect.any(Function),
            verify: expect.any(Function),
          },
          requireEmailVerification: true,
          sendResetPassword: expect.any(Function),
        },
      }),
    );
  });

  it("should disable email, OIDC, and social signup when the global signup disable flag is enabled", () => {
    process.env.AUTH_DISABLE_SIGN_UP = "true";
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

  it("should merge email auth options without dropping email signup disable env flags", () => {
    process.env.AUTH_EMAIL_DISABLE_SIGN_UP = "true";
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
          password: {
            hash: expect.any(Function),
            verify: expect.any(Function),
          },
          requireEmailVerification: true,
          sendResetPassword: expect.any(Function),
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

    const { authHandlerMiddleware } = await createAuthModule(
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
    expect(middlewareManager.apply).toHaveBeenCalledWith(authHandlerMiddleware);
    expect(authProxy.disableGlobalExcludeRoutes).toHaveBeenCalledTimes(1);
    expect(authProxy.forRoutes).toHaveBeenCalledWith("/auth");
    expect(middlewareManager.apply).toHaveBeenCalledWith(authMiddleware);
    expect(middlewareProxy.dependencies).toHaveBeenCalledWith(
      RequestContextMiddleware,
    );
    expect(middlewareProxy.before).not.toHaveBeenCalled();
    expect(middlewareProxy.after).not.toHaveBeenCalled();
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
