import { ConfigurableModuleBuilder } from "@nestjs/common";

import type { HealthCheckModuleOptions } from "./health-check-module-options.interface.js";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<HealthCheckModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
