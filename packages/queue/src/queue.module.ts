import { BullModule as BaseQueueModule } from "@nestjs/bullmq";
import { type DynamicModule, Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { createJobProviders } from "./job.providers.js";
import { QueueHealthIndicator } from "./queue.health-indicator.js";
import {
  ASYNC_OPTIONS_TYPE,
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./queue.module-definition.js";
import { QueueModuleOptions } from "./queue-module-options.interface.js";
import type {
  RegisterQueueAsyncOptions,
  RegisterQueueOptions,
} from "./register-queue-options.interface.js";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util.js";
import { withQueuePersistence } from "./utils/with-queue-persistence.util.js";

const jobProviders = await createJobProviders();

/**
 * BullMQ integration module for job queue processing.
 *
 * Wraps `@nestjs/bullmq` with automatic Redis connection configuration
 * from `REDIS_URL`. Registers job history when DatabaseModule and Job metadata
 * are available; only queues registered with persist: true record jobs. Enables
 * job queries when GraphQLModule is also registered unless
 * the graphql option is false.
 */
@Global()
@Module({
  imports: [
    DiscoveryModule,
    BaseQueueModule.forRootAsync({
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: QueueModuleOptions) => {
        const bullOptions = { ...options };
        delete bullOptions.history;
        delete bullOptions.getJobReadFilter;
        delete bullOptions.graphql;
        return {
          ...bullOptions,
          connection: options.connection ?? loadConfigFromEnv(),
        };
      },
    }),
  ],
  providers: [
    ...(jobProviders.providers ?? []),
    QueueHealthIndicator,
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options?: QueueModuleOptions) => options ?? {},
    },
  ],
  exports: [
    MODULE_OPTIONS_TOKEN,
    QueueHealthIndicator,
    ...(jobProviders.exports ?? []),
  ],
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
  static registerQueue(...args: RegisterQueueOptions[]): DynamicModule {
    return withQueuePersistence(BaseQueueModule.registerQueue(...args), args);
  }

  /**
   * Registers a BullMQ queue asynchronously.
   * @param args - registerQueueAsync arguments
   * @returns Dynamic module configuration
   */
  static registerQueueAsync(
    ...args: RegisterQueueAsyncOptions[]
  ): DynamicModule {
    return withQueuePersistence(
      BaseQueueModule.registerQueueAsync(...args),
      args,
    );
  }
}
