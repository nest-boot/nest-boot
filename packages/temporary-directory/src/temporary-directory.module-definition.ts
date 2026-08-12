import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type TemporaryDirectoryModuleOptions } from "./temporary-directory-module-options.interface";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<TemporaryDirectoryModuleOptions>().build();
