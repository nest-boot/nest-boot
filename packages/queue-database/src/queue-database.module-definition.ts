import { ConfigurableModuleBuilder } from "@nestjs/common";

import { QueueDatabaseModuleOptions } from "./queue-database-module-options.interface.js";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<QueueDatabaseModuleOptions>()
    .setClassMethodName("forRoot")
    .build();
