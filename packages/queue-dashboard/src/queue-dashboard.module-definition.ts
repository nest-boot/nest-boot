import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type QueueDashboardModuleOptions } from "./queue-dashboard-module-options.interface";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<QueueDashboardModuleOptions>().build();
