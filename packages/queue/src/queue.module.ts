import { BullModule as BaseBullModule } from "@nestjs/bullmq";
import { type DynamicModule, Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import {
  ASYNC_OPTIONS_TYPE,
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./queue.module-definition.js";
import { QueueHealthIndicator } from "./queue-health.indicator.js";
import { QueueModuleOptions } from "./queue-module-options.interface.js";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util.js";

/**
 * BullMQ integration module for job queue processing.
 *
 * @remarks
 * Wraps `@nestjs/bullmq` with automatic Redis connection configuration
 * from `REDIS_URL`. Supports registering queues and flow producers.
 */
@Global()
@Module({
  imports: [
    DiscoveryModule,
    BaseBullModule.forRootAsync({
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: QueueModuleOptions) => {
        return {
          ...options,
          connection: options.connection ?? loadConfigFromEnv(),
        };
      },
    }),
  ],
  providers: [
    QueueHealthIndicator,
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options?: QueueModuleOptions) => options ?? {},
    },
  ],
  exports: [MODULE_OPTIONS_TOKEN, QueueHealthIndicator],
})
export class QueueModule extends ConfigurableModuleClass {
  /**
   * Registers the QueueModule with the given options.
   * @param options - Configuration options including Redis connection
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the QueueModule asynchronously with factory functions.
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
