import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type StorageModuleOptions } from "./interfaces/storage-module-options.interface.js";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<StorageModuleOptions>().build();
