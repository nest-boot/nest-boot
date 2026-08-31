import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type S3ModuleOptions } from "./s3-module-options.type.js";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<S3ModuleOptions>().build();
