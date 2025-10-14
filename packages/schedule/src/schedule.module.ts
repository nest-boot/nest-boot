import { BullModule } from "@nest-boot/bullmq";
import { type DynamicModule, Global, Logger, Module } from "@nestjs/common";
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

@Global()
@Module({
  imports: [
    DiscoveryModule,
    BullModule.registerQueueAsync({
      name: "schedule",
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options: ScheduleModuleOptions) => {
        return {
          ...options,
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: true,
            ...options?.defaultJobOptions,
          },
        };
      },
    }),
  ],
  providers: [Logger, ScheduleRegistry, ScheduleProcessor],
  exports: [],
})
export class ScheduleModule extends ConfigurableModuleClass {
  private static patchDynamicModule(
    dynamicModule: DynamicModule,
  ): DynamicModule {
    dynamicModule.exports = [MODULE_OPTIONS_TOKEN];
    return dynamicModule;
  }

  static forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return this.patchDynamicModule(super.forRoot(options));
  }

  static forRootAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return this.patchDynamicModule(super.forRootAsync(options));
  }
}
