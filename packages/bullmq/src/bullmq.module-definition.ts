import { ConfigurableModuleBuilder } from "@nestjs/common";
import { randomUUID } from "crypto";

import { BullModuleOptions } from "./bullmq-module-options.interface";

export const SCHEDULE_QUEUE_NAME = "schedule";

export const SCHEDULE_METADATA_KEY = randomUUID();

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<BullModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
