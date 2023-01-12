import { ConfigurableModuleBuilder } from "@nestjs/common";
import { randomUUID } from "crypto";

import { QueueModuleOptions } from "./interfaces/queue-module-options.interface";

export const PROCESSOR_METADATA_KEY = randomUUID();

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<QueueModuleOptions>()
  .setExtras(
    {
      name: "default",
      isGlobal: true,
    },
    (definition, extras) => ({
      ...definition,
      global: extras.isGlobal,
    })
  )
  .setClassMethodName("registerQueue")
  .build();
