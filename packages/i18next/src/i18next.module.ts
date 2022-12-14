import { DynamicModule, Global, Module, Scope } from "@nestjs/common";
import i18next, { InitOptions } from "i18next";
import Backend from "i18next-fs-backend";
import middleware from "i18next-http-middleware";

import { I18NEXT_INSTANCE, I18NEXT_TRANSLATION } from "./constants";
import { getI18next, getTranslation } from "./utils";

@Global()
@Module({})
export class I18nextModule {
  static register(options: InitOptions): DynamicModule {
    void i18next.use(Backend).use(middleware.LanguageDetector).init(options);

    const providers = [
      {
        provide: I18NEXT_INSTANCE,
        useFactory: () => getI18next(),
        scope: Scope.TRANSIENT,
      },
      {
        provide: I18NEXT_TRANSLATION,
        useFactory: () => getTranslation(),
        scope: Scope.TRANSIENT,
      },
    ];

    return {
      module: I18nextModule,
      providers,
      exports: providers,
    };
  }
}
