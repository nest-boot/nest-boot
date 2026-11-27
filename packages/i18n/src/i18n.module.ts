import { MiddlewareManager, MiddlewareModule } from "@nest-boot/middleware";
import {
  RequestContextMiddleware,
  RequestContextModule,
} from "@nest-boot/request-context";
import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
  Optional,
  type Provider,
} from "@nestjs/common";
import i18next, { type i18n } from "i18next";
import Backend from "i18next-fs-backend";
import { LanguageDetector } from "i18next-http-middleware";
import path from "path";

import { I18N } from "./i18n.constants.js";
import { I18nMiddleware } from "./i18n.middleware.js";
import {
  type ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  type OPTIONS_TYPE,
} from "./i18n.module-definition.js";
import { type I18nModuleOptions } from "./interfaces/i18n-module-options.interface.js";
import {
  getDefaultI18nInstance,
  setDefaultI18nInstance,
} from "./utils/translation.js";

const i18nProvider: Provider<i18n> = {
  provide: I18N,
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: async (moduleOptions: I18nModuleOptions = {}) => {
    const instance = i18next
      .createInstance()
      .use(Backend)
      .use(LanguageDetector);

    await instance.init({
      backend: {
        loadPath: path.join(process.cwd(), "locales/{{lng}}/{{ns}}.json"),
        addPath: path.join(process.cwd(), "locales/{{lng}}/{{ns}}.json"),
      },
      fallbackLng: "en",
      keySeparator: false,
      interpolation: { escapeValue: false },
      ...moduleOptions,
    });

    setDefaultI18nInstance(instance);

    return instance;
  },
};

/**
 * Global module that provides i18n (internationalization) support via i18next.
 *
 * Initializes an isolated i18next instance with file-system backend and HTTP
 * language detection, and makes it available through dependency injection and
 * the request context.
 */
@Global()
@Module({
  imports: [RequestContextModule, MiddlewareModule],
  providers: [I18nMiddleware, i18nProvider],
  exports: [i18nProvider],
})
export class I18nModule
  extends ConfigurableModuleClass
  implements OnApplicationShutdown
{
  /**
   * Registers the I18nModule with synchronous options.
   * @param options - i18next configuration options
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the I18nModule with asynchronous options.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }

  /**
   * Registers i18n middleware after request context initialization.
   * @param middlewareManager - Manager that registers request middleware.
   * @param i18nMiddleware - Middleware that resolves the request language.
   * @param i18nInstance - Module-owned i18next instance.
   */
  constructor(
    middlewareManager: MiddlewareManager,
    i18nMiddleware: I18nMiddleware,
    @Optional()
    @Inject(I18N)
    private readonly i18nInstance?: i18n,
  ) {
    super();

    middlewareManager
      .apply(i18nMiddleware)
      .dependencies(RequestContextMiddleware)
      .forRoutes("*");
  }

  /** Clears the module-level fallback reference when the owning application shuts down. */
  onApplicationShutdown(): void {
    if (this.i18nInstance && getDefaultI18nInstance() === this.i18nInstance) {
      setDefaultI18nInstance(undefined);
    }
  }
}
