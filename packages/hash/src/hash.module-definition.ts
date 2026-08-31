import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type HashModuleOptions } from "./hash-module-options.interface.js";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<HashModuleOptions>().build();
