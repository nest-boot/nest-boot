import { BullModule as BaseBullModule } from "@nestjs/bullmq";
import { type DynamicModule, Global, Module } from "@nestjs/common";

import {
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./bullmq.module-definition";
import { BullModuleOptions } from "./bullmq-module-options.interface";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

@Global()
@Module({
  imports: [
    BaseBullModule.forRootAsync({
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: BullModuleOptions) => {
        return {
          ...options,
          connection: options.connection ?? loadConfigFromEnv(),
        };
      },
    }),
  ],
  providers: [
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options?: BullModuleOptions) => options ?? {},
    },
  ],
  exports: [MODULE_OPTIONS_TOKEN],
})
export class BullModule extends ConfigurableModuleClass {
  static registerQueue(
    ...args: Parameters<typeof BaseBullModule.registerQueue>
  ): DynamicModule {
    return BaseBullModule.registerQueue(...args);
  }

  static registerQueueAsync(
    ...args: Parameters<typeof BaseBullModule.registerQueueAsync>
  ): DynamicModule {
    return BaseBullModule.registerQueueAsync(...args);
  }
}
