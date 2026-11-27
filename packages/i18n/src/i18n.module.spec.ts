const mocks = vi.hoisted(() => ({
  createInstance: vi.fn(),
  init: vi.fn(() => Promise.resolve()),
  use: vi.fn(),
}));

vi.mock("i18next", () => {
  const createMockInstance = () => {
    const instance = {
      init: mocks.init,
      use: mocks.use,
    };
    mocks.use.mockReturnValue(instance);
    return instance;
  };
  mocks.createInstance.mockImplementation(createMockInstance);

  return {
    default: {
      createInstance: mocks.createInstance,
    },
  };
});

vi.mock("i18next-fs-backend", () => ({
  default: class TestBackend {},
}));

vi.mock("i18next-http-middleware", () => ({
  handle: vi.fn(),
  LanguageDetector: class TestLanguageDetector {},
}));

import type { MiddlewareManager } from "@nest-boot/middleware";
import { RequestContextMiddleware } from "@nest-boot/request-context";
import type { FactoryProvider } from "@nestjs/common";
import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from "@nestjs/common/constants";

import { I18N } from "./i18n.constants.js";
import type { I18nMiddleware } from "./i18n.middleware.js";
import { I18nModule } from "./i18n.module.js";
import { MODULE_OPTIONS_TOKEN } from "./i18n.module-definition.js";
import type { I18nModuleOptions } from "./interfaces/i18n-module-options.interface.js";
import { getDefaultI18nInstance } from "./utils/translation.js";

describe("I18nModule", () => {
  beforeEach(() => {
    mocks.createInstance.mockClear();
    mocks.init.mockClear();
    mocks.use.mockClear();
  });

  it("is decorated with @Global() and initializes a fresh i18next instance with defaults", async () => {
    const options: I18nModuleOptions = {
      lng: "de",
      resources: {
        de: { translation: { greeting: "Hallo" } },
      },
    };
    const provider = getI18nProvider();

    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, I18nModule)).toBe(true);
    const firstInstance = (await provider.useFactory()) as unknown;
    expect(mocks.createInstance).toHaveBeenCalledOnce();
    expect(getDefaultI18nInstance()).toBe(firstInstance);
    expect(mocks.init).toHaveBeenCalledWith({
      backend: {
        addPath: expect.stringContaining("locales/{{lng}}/{{ns}}.json"),
        loadPath: expect.stringContaining("locales/{{lng}}/{{ns}}.json"),
      },
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      keySeparator: false,
    });

    mocks.init.mockClear();
    const secondInstance = (await provider.useFactory(options)) as unknown;
    expect(secondInstance).not.toBe(firstInstance);
    expect(getDefaultI18nInstance()).toBe(secondInstance);
    expect(mocks.init).toHaveBeenCalledWith({
      backend: {
        addPath: expect.stringContaining("locales/{{lng}}/{{ns}}.json"),
        loadPath: expect.stringContaining("locales/{{lng}}/{{ns}}.json"),
      },
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      keySeparator: false,
      lng: "de",
      resources: options.resources,
    });
  });

  it("registers synchronous and asynchronous options via forRoot and forRootAsync", () => {
    const options: I18nModuleOptions = { fallbackLng: "en" };
    const useFactory = () => Promise.resolve(options);
    const defaultModule = I18nModule.forRoot();
    const syncModule = I18nModule.forRoot(options);
    const asyncModule = I18nModule.forRootAsync({ useFactory });

    expect(defaultModule.module).toBe(I18nModule);
    expect(syncModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
      ]),
    );
    expect(asyncModule.providers).toEqual(
      expect.arrayContaining([
        {
          inject: [],
          provide: MODULE_OPTIONS_TOKEN,
          useFactory,
        },
      ]),
    );
  });

  it("registers i18n middleware after request context middleware", () => {
    const forRoutes = vi.fn();
    const dependencies = vi.fn(() => ({ forRoutes }));
    const apply = vi.fn(() => ({ dependencies }));
    const middlewareManager = { apply } as unknown as MiddlewareManager;
    const i18nMiddleware = {} as I18nMiddleware;

    const moduleInstance = new I18nModule(middlewareManager, i18nMiddleware);
    moduleInstance.onApplicationShutdown();

    expect(apply).toHaveBeenCalledWith(i18nMiddleware);
    expect(dependencies).toHaveBeenCalledWith(RequestContextMiddleware);
    expect(forRoutes).toHaveBeenCalledWith("*");
  });

  it("clears the default fallback instance only when owned by the shutting-down module", async () => {
    const forRoutes = vi.fn();
    const dependencies = vi.fn(() => ({ forRoutes }));
    const apply = vi.fn(() => ({ dependencies }));
    const middlewareManager = { apply } as unknown as MiddlewareManager;
    const i18nMiddleware = {} as I18nMiddleware;
    const provider = getI18nProvider();
    const firstInstance = await provider.useFactory();
    const secondInstance = await provider.useFactory();

    const firstModule = new I18nModule(
      middlewareManager,
      i18nMiddleware,
      firstInstance as never,
    );
    firstModule.onApplicationShutdown();
    expect(getDefaultI18nInstance()).toBe(secondInstance);

    const secondModule = new I18nModule(
      middlewareManager,
      i18nMiddleware,
      secondInstance as never,
    );
    secondModule.onApplicationShutdown();
    expect(getDefaultI18nInstance()).toBeUndefined();
  });
});

/**
 * Returns factory provider that initializes i18next on I18nModule.
 * @returns Factory provider that initializes i18next.
 */
function getI18nProvider(): FactoryProvider<I18nModuleOptions> {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    I18nModule,
  ) as unknown[] | undefined;
  const provider = providers?.find(
    (candidate): candidate is FactoryProvider<I18nModuleOptions> =>
      typeof candidate === "object" &&
      candidate !== null &&
      "provide" in candidate &&
      candidate.provide === I18N,
  );

  if (!provider) {
    throw new Error("Expected the i18n provider");
  }

  return provider;
}
