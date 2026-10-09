import { ConfigurableModuleBuilder } from "@nestjs/common";

import { DatabaseModuleOptions } from "./interfaces/database-module-options.interface.js";

export const MODULE_OPTIONS_TOKEN = Symbol("DatabaseModuleOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<DatabaseModuleOptions>()
  .setClassMethodName("forRoot")
  .setExtras<{
    driverHint?: DatabaseModuleOptions["driver"];
  }>({ driverHint: undefined })
  .build();
