import { QueueModule } from "@nest-boot/queue";
import { type DynamicModule, Global, Logger, Module } from "@nestjs/common";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";

import {
  type ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  type OPTIONS_TYPE,
} from "./schedule.module-definition";
import { ScheduleService } from "./schedule.service";
import { type ScheduleModuleOptions } from "./schedule-module-options.interface";

@Global()
@Module({
  providers: [DiscoveryService, MetadataScanner, Logger, ScheduleService],
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
    const ScheduleQueueDynamicModule = QueueModule.registerAsync({
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
