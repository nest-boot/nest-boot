import { ConfigurableModuleBuilder } from "@nestjs/common";

import type { MastraModuleOptions } from "./interfaces/mastra-module-options.interface.js";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: MASTRA_MODULE_OPTIONS,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<MastraModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
