/* eslint-disable @typescript-eslint/no-namespace */

declare global {
  namespace NestBootCommon {
    interface Context {
      accessToken?: string;
      user?: NestBootAuth.User;
    }
  }

  namespace NestBootAuth {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User {}
  }
}

export * from "./entities";
export * from "./guards";
export * from "./interfaces";
export * from "./middlewares";
export * from "./utils";
