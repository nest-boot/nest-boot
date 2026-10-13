import { Global, Logger, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./schedule.module-definition.js";
import { ScheduleProcessor } from "./schedule.processor.js";
import { ScheduleQueue } from "./schedule.queue.js";
import { ScheduleRegistry } from "./schedule.registry.js";

/**
 * Job scheduling module powered by BullMQ.
 *
 * Provides cron-like job scheduling using BullMQ queues.
 * Supports decorator-based schedule registration and configurable concurrency.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    Logger,
    ScheduleRegistry,
    ScheduleProcessor,
    ScheduleQueue,
    { provide: MODULE_OPTIONS_TOKEN, useValue: {} },
  ],
  exports: [MODULE_OPTIONS_TOKEN],
})
export class ScheduleModule extends ConfigurableModuleClass {}
