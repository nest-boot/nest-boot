import { type DynamicModule, Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { createJobProviders } from "./job.providers.js";
import { QueueFactory } from "./queue.factory.js";
import { QueueHealthIndicator } from "./queue.health-indicator.js";
import {
  ASYNC_OPTIONS_TYPE,
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./queue.module-definition.js";
import { QueueModuleOptions } from "./queue-module-options.interface.js";
import { QueueRuntimeModule } from "./queue-runtime.module.js";

const jobProviders = await createJobProviders();

/**
 * BullMQ integration module for job queue processing.
 *
 * Uses BullMQ directly with automatic Redis connection configuration
 * from `REDIS_URL`. Registers JobService when DatabaseModule and Job metadata are available;
 * only queue classes with persistence.enabled: true record jobs. Enables
 * job queries when GraphQLModule is also registered unless
 * the graphql option is false.
 */
@Global()
@Module({
  imports: [DiscoveryModule, QueueRuntimeModule],
  providers: [
    ...jobProviders.providers,
    QueueHealthIndicator,
    QueueFactory,
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options?: QueueModuleOptions) => options ?? {},
    },
  ],
  exports: [
    MODULE_OPTIONS_TOKEN,
    QueueHealthIndicator,
    QueueFactory,
    ...jobProviders.exports,
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
}
