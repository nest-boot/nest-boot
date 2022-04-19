/* eslint-disable @typescript-eslint/no-namespace */

import { EntityManager } from "@mikro-orm/core";

declare global {
  namespace NestBootCommon {
    interface Context {
      entityManager?: EntityManager;
    }
  }
}

export * from "@mikro-orm/core";
export * from "@mikro-orm/nestjs";

export * from "./database.module";
export * from "./database.middleware";
