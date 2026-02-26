import { ConfigurableModuleBuilder } from "@nestjs/common";

import { MikroOrmModuleOptions } from "./interfaces/mikro-orm-module-options.interface";

/**
 * Injection token for MikroOrmModule options.
 */
export const MODULE_OPTIONS_TOKEN = Symbol("MikroOrmModuleOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<MikroOrmModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
