const mocks = vi.hoisted(() => ({
  init: vi.fn(() => Promise.resolve()),
  use: vi.fn(),
}));

vi.mock("i18next", () => {
  const instance = {
    init: mocks.init,
    use: mocks.use,
  };
  mocks.use.mockReturnValue(instance);

  return { default: instance };
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
import type { DynamicModule, FactoryProvider } from "@nestjs/common";

import { I18N } from "./i18n.constants.js";
import type { I18nMiddleware } from "./i18n.middleware.js";
import { I18nModule } from "./i18n.module.js";
import type { I18nModuleOptions } from "./interfaces/i18n-module-options.interface.js";

describe("I18nModule", () => {
  beforeEach(() => {
    mocks.init.mockClear();
  });

  it("registers globally and initializes i18next with defaults", async () => {
    const options: I18nModuleOptions = {
      lng: "de",
      resources: {
        de: { translation: { greeting: "Hallo" } },
      },
    };
    const dynamicModule = I18nModule.register(options);
    const provider = getI18nProvider(dynamicModule.providers);

    expect(dynamicModule.global).toBe(true);
    await provider.useFactory?.(options);
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

  it("supports non-global asynchronous registration", () => {
    const dynamicModule = I18nModule.registerAsync({
      isGlobal: false,
      useFactory: () => Promise.resolve({ fallbackLng: "en" }),
    });

    expect(dynamicModule.global).toBe(false);
    expect(getI18nProvider(dynamicModule.providers).inject).toHaveLength(1);
  });

  it("registers i18n middleware after request context middleware", () => {
    const forRoutes = vi.fn();
    const dependencies = vi.fn(() => ({ forRoutes }));
    const apply = vi.fn(() => ({ dependencies }));
    const middlewareManager = { apply } as unknown as MiddlewareManager;
    const i18nMiddleware = {} as I18nMiddleware;

    new I18nModule(middlewareManager, i18nMiddleware);

    expect(apply).toHaveBeenCalledWith(i18nMiddleware);
    expect(dependencies).toHaveBeenCalledWith(RequestContextMiddleware);
    expect(forRoutes).toHaveBeenCalledWith("*");
  });
});

function getI18nProvider(
  providers: DynamicModule["providers"] | undefined,
): FactoryProvider<I18nModuleOptions> {
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
