/* eslint-disable @typescript-eslint/no-namespace */

import { Request, Response } from "express";
import { Logger } from "pino";

declare global {
  namespace NestBootCommon {
    interface Context {
      readonly req?: Request;
      readonly res?: Response;
      readonly logger?: Logger;
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
