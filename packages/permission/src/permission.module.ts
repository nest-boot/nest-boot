import { Global, Module } from "@nestjs/common";

import { PermissionGuard } from "./permission.guard.js";
import { ConfigurableModuleClass } from "./permission.module-definition.js";

/** Global module that provides the permission guard. */
@Global()
@Module({
  providers: [PermissionGuard],
  exports: [PermissionGuard],
})
export class PermissionModule extends ConfigurableModuleClass {}
