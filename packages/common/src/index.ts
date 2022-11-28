/* eslint-disable @typescript-eslint/no-namespace */

import { Type } from "@nestjs/common";

declare global {
  namespace NestBootCommon {
    interface Context {
      get: <T>(key: Type<T> | string | symbol) => T | undefined;
      set: <T>(key: Type<T> | string | symbol, value: T) => void;
    }
  }
}

export * from "./constants";
export * from "./context";
export * from "./decorators";
export * from "./middlewares";
export * from "./modules/logger.module";
export * from "./services/logger.service";
export * from "./utils";
