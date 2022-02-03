/* eslint-disable @typescript-eslint/no-namespace */

import { i18n as I18Next, TFunction as Translation } from "i18next";

declare global {
  namespace NestBootCommon {
    interface Context {
      i18n?: I18Next;
    }
  }
}

export * from "./configs";
export * from "./constants";
export * from "./decorators";
export * from "./i18next.middleware";
export * from "./i18next.module";
export * from "./utils";

export { I18Next, Translation };
