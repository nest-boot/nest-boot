/* eslint-disable @typescript-eslint/no-namespace */

declare global {
  namespace NestBootCommon {
    interface Context {
      tenantId?: string;
    }
  }
}

export * from "./mixin-tenant-id.util";
export * from "./tenant.middleware";
export * from "./tenant.module";
