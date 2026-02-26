import { RequestContextModule } from "@nest-boot/request-context";
import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  type Provider,
} from "@nestjs/common";
import i18next, { type i18n } from "i18next";
import Backend from "i18next-fs-backend";
import { LanguageDetector } from "i18next-http-middleware";
import path from "path";

import { I18N } from "./i18n.constants";
import { I18nMiddleware } from "./i18n.middleware";
import {
  type ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  type OPTIONS_TYPE,
} from "./i18n.module-definition";
import { type I18nModuleOptions } from "./interfaces/i18n-module-options.interface";

i18next.use(Backend).use(LanguageDetector);

/**
 * Module for Internationalization (i18n) support.
 * Wraps i18next and i18next-http-middleware.
 */
@Module({
  imports: [RequestContextModule],
})
export class I18nModule extends ConfigurableModuleClass implements NestModule {
  /**
   * Registers the module synchronously.
   */
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    return {
      ...this.with(options, super.register(options)),
    };
  }

  /**
   * Registers the module asynchronously.
   */
  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return {
      ...this.with(options, super.registerAsync(options)),
    };
  }

  private static with(
    options: typeof OPTIONS_TYPE | typeof ASYNC_OPTIONS_TYPE,
    dynamicModule: DynamicModule,
  ): DynamicModule {
    const provider: Provider<i18n> = {
      provide: I18N,
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: async (moduleOptions: I18nModuleOptions) => {
        await i18next.init({
          backend: {
            loadPath: path.join(process.cwd(), "locales/{{lng}}/{{ns}}.json"),
            addPath: path.join(process.cwd(), "locales/{{lng}}/{{ns}}.json"),
          },
          fallbackLng: "en",
          keySeparator: false,
          interpolation: { escapeValue: false },
          ...moduleOptions,
        });

        return i18next;
      },
    };

    return {
      ...dynamicModule,
      providers: [...(dynamicModule.providers ?? []), provider],
      exports: [...(dynamicModule.exports ?? []), provider],
    };
  }

  /**
   * Configures the middleware.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(I18nMiddleware).forRoutes("*");
  }
}
