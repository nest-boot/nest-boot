import { ConfigurableModuleBuilder } from "@nestjs/common";

import type { PermissionModuleOptions } from "./interfaces/permission-module-options.interface.js";

const moduleDefinition =
  new ConfigurableModuleBuilder<PermissionModuleOptions>()
    .setClassMethodName("forRoot")
    .build();

/** Configurable module base class for `PermissionModule`. */
export const ConfigurableModuleClass = moduleDefinition.ConfigurableModuleClass;

/** Injection token for permission module options. */
export const MODULE_OPTIONS_TOKEN = moduleDefinition.MODULE_OPTIONS_TOKEN;
