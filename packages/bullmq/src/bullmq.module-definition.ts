import { ConfigurableModuleBuilder } from "@nestjs/common";
import { randomUUID } from "crypto";

import { BullModuleOptions } from "./bullmq-module-options.interface";

export const SCHEDULE_QUEUE_NAME = "schedule";

export const SCHEDULE_METADATA_KEY = randomUUID();

export const MODULE_OPTIONS_TOKEN = Symbol("BullModuleOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<BullModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
