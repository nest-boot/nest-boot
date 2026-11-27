import { ConfigurableModuleBuilder } from "@nestjs/common";

import type { JwtModuleOptions } from "./interfaces/jwt-module-options.interface.js";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<JwtModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
