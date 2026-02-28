import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type AuthModuleOptions } from "./auth-module-options.interface";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<AuthModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
