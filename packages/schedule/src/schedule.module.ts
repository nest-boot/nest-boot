import { BullModule } from "@nest-boot/bullmq";
import { Global, Logger, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import {
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./schedule.module-definition";
import { ScheduleProcessor } from "./schedule.processor";
import { ScheduleRegistry } from "./schedule.registry";
import { type ScheduleModuleOptions } from "./schedule-module-options.interface";

/**
 * Module for scheduling tasks using BullMQ.
 * It registers a dedicated 'schedule' queue and a processor to execute scheduled methods.
 */
@Global()
@Module({
  imports: [
    DiscoveryModule,
    BullModule.registerQueueAsync({
      name: "schedule",
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: ScheduleModuleOptions) => options,
    }),
  ],
  providers: [
    Logger,
    ScheduleRegistry,
    ScheduleProcessor,
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options?: ScheduleModuleOptions) => options ?? {},
    },
  ],
  exports: [MODULE_OPTIONS_TOKEN],
})
export class ScheduleModule extends ConfigurableModuleClass {}
