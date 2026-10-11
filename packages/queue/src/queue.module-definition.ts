import { ConfigurableModuleBuilder } from "@nestjs/common";

import { QueueModuleOptions } from "./queue-module-options.interface.js";

export { MODULE_OPTIONS_TOKEN } from "./queue.constants.js";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<QueueModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
