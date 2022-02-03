/* eslint-disable @typescript-eslint/no-namespace */

import { Request, Response } from "express";

declare global {
  namespace NestBootCommon {
    interface Context {
      readonly req?: Request;
      readonly res?: Response;
    }
  }
}

export * from "./constants";
export * from "./context";
export * from "./decorators";
export * from "./middlewares";
export * from "./utils";
