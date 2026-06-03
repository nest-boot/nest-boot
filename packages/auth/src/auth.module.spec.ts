import { MikroORM } from "@mikro-orm/core";
import { RequestContextMiddleware } from "@nest-boot/request-context";
import { MODULE_METADATA } from "@nestjs/common/constants";

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

jest.mock("better-auth", () => ({
  betterAuth: mockBetterAuth,
}));
jest.mock("better-auth/node", () => ({
  toNodeHandler: mockToNodeHandler,
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

describe("AuthModule", () => {
  const secret =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_abcdefghijklmnopqrstuvwxyz";

  beforeEach(() => {
    mockBetterAuth.mockClear();
    mockMikroOrmAdapter.mockClear();
    mockToNodeHandler.mockClear();
    delete process.env.APP_SECRET;
    delete process.env.AUTH_SECRET;
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

  it("should register auth handler and auth middleware routes", () => {
    const auth = {
      api: {},
    };
    const authMiddleware = {} as AuthMiddleware;
    Object.setPrototypeOf(authMiddleware, AuthMiddleware.prototype);
    const { authProxy, middlewareManager, middlewareProxy } =
      createMiddlewareManager();

    new AuthModule(
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

  it("should use defaults and skip auth middleware registration when disabled", () => {
    const auth = {
      api: {},
    };
    const authMiddleware = {} as AuthMiddleware;
    Object.setPrototypeOf(authMiddleware, AuthMiddleware.prototype);
    const { authProxy, middlewareManager, middlewareProxy } =
      createMiddlewareManager();

    new AuthModule(
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
