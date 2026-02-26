import { ConfigurableModuleBuilder } from "@nestjs/common";
import { randomUUID } from "crypto";

import { type ScheduleModuleOptions } from "./schedule-module-options.interface";

/**
 * Queue name used for scheduling.
 */
export const SCHEDULE_QUEUE_NAME = "schedule";

/**
 * Metadata key for scheduled methods.
 */
export const SCHEDULE_METADATA_KEY = randomUUID();

/**
 * Injection token for ScheduleModule options.
 */
export const MODULE_OPTIONS_TOKEN = Symbol("ScheduleModuleOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<ScheduleModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
