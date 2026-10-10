import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type StagedUploadModuleOptions } from "./staged-upload-options.interface.js";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<StagedUploadModuleOptions>().build();
