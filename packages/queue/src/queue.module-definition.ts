import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type QueueModuleOptions } from "./interfaces";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<QueueModuleOptions>()
  .setExtras(
    {
      name: "default",
    },
    (definition, extras) => ({
      ...extras,
      ...definition,
    }),
  )
  .build();
