import { ConfigurableModuleBuilder } from "@nestjs/common";
import { randomUUID } from "crypto";

import { BullModuleOptions } from "./bullmq-module-options.interface";

/**
 * Default queue name for scheduling.
 */
export const SCHEDULE_QUEUE_NAME = "schedule";

/**
 * Metadata key for scheduling.
 */
export const SCHEDULE_METADATA_KEY = randomUUID();

/**
 * Injection token for BullModule options.
 */
export const MODULE_OPTIONS_TOKEN = Symbol("BullModuleOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<BullModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
