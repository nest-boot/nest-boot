import { BullModule as BaseBullModule } from "@nestjs/bullmq";
import { type DynamicModule, Global, Module } from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./bullmq.module-definition";
import { BullModuleOptions } from "./bullmq-module-options.interface";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

/**
 * BullMQ integration module for job queue processing.
 *
 * @remarks
 * Wraps `@nestjs/bullmq` with automatic Redis connection configuration
 * from environment variables. Supports registering queues and flow producers.
 */
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
  /**
   * Registers the BullModule with the given options.
   * @param options - Configuration options including Redis connection
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the BullModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }

  /**
   * Registers a BullMQ queue.
   * @param args - registerQueue arguments
   * @returns Dynamic module configuration
   */
  static registerQueue(
    ...args: Parameters<typeof BaseBullModule.registerQueue>
  ): DynamicModule {
    return BaseBullModule.registerQueue(...args);
  }

  /**
   * Registers a BullMQ queue asynchronously.
   * @param args - registerQueueAsync arguments
   * @returns Dynamic module configuration
   */
  static registerQueueAsync(
    ...args: Parameters<typeof BaseBullModule.registerQueueAsync>
  ): DynamicModule {
    return BaseBullModule.registerQueueAsync(...args);
  }
}
