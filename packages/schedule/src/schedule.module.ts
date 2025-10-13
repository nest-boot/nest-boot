import { BullModule } from "@nestjs/bullmq";
import { type DynamicModule, Logger, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import {
  type ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  type OPTIONS_TYPE,
} from "./schedule.module-definition";
import { ScheduleProcessor } from "./schedule.processor";
import { ScheduleRegistry } from "./schedule.registry";
import { type ScheduleModuleOptions } from "./schedule-module-options.interface";

@Module({
  imports: [DiscoveryModule],
  providers: [Logger, ScheduleRegistry, ScheduleProcessor],
  exports: [],
})
export class ScheduleModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    return this.withQueue(super.register(options));
  }

  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return this.withQueue(super.registerAsync(options));
  }

  private static withQueue(dynamicModule: DynamicModule): DynamicModule {
    const ScheduleQueueDynamicModule = BullModule.registerQueueAsync({
      name: "schedule",
      imports: [dynamicModule],
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: ScheduleModuleOptions) => options,
    });

    dynamicModule.imports = [
      ...(dynamicModule.imports ?? []),
      ScheduleQueueDynamicModule,
    ];

    dynamicModule.exports = [MODULE_OPTIONS_TOKEN];

    return dynamicModule;
  }
}
