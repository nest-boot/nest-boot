import { ConfigurableModuleBuilder } from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "./queue.constants.js";
import { QueueModuleOptions } from "./queue-module-options.interface.js";

export { MODULE_OPTIONS_TOKEN } from "./queue.constants.js";

export const { ConfigurableModuleClass, OPTIONS_TYPE, ASYNC_OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<QueueModuleOptions>({
    optionsInjectionToken: MODULE_OPTIONS_TOKEN,
  })
    .setClassMethodName("forRoot")
    .build();
