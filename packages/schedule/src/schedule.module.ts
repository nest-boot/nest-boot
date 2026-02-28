import { BullModule } from "@nest-boot/bullmq";
import { type DynamicModule, Global, Logger, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import {
  ASYNC_OPTIONS_TYPE,
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./schedule.module-definition";
import { ScheduleProcessor } from "./schedule.processor";
import { ScheduleRegistry } from "./schedule.registry";
import { type ScheduleModuleOptions } from "./schedule-module-options.interface";

/**
 * Job scheduling module powered by BullMQ.
 *
 * @remarks
 * Provides cron-like job scheduling using BullMQ queues.
 * Supports decorator-based schedule registration and configurable concurrency.
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
export class ScheduleModule extends ConfigurableModuleClass {
  /**
   * Registers the ScheduleModule with the given options.
   * @param options - Configuration options including connection and concurrency
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the ScheduleModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }
}
