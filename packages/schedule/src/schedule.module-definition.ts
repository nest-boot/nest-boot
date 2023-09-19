import { ConfigurableModuleBuilder } from "@nestjs/common";
import { randomUUID } from "crypto";

import { type ScheduleModuleOptions } from "./schedule-module-options.interface";

export const SCHEDULE_QUEUE_NAME = "schedule";

export const SCHEDULE_METADATA_KEY = randomUUID();

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<ScheduleModuleOptions>().build();
