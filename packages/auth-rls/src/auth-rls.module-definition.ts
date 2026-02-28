import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type AuthRlsModuleOptions } from "./auth-rls-module-options.interface";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<AuthRlsModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
