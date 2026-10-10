import { ConfigurableModuleAsyncOptions, Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { JobEntity } from "./entities/job.entity.js";
import { ConfigurableModuleClass } from "./queue-database.module-definition.js";
import { QueueDatabaseService } from "./queue-database.service.js";
import { QueueDatabaseModuleOptions } from "./queue-database-module-options.interface.js";

/**
 * Module that integrates BullMQ job events with MikroORM persistence.
 *
 * Subscribes to BullMQ queue events and automatically persists job state
 * changes to the database using the configured entity.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [QueueDatabaseService],
})
export class QueueDatabaseModule extends ConfigurableModuleClass {
  /**
   * Registers the module with synchronous options.
   * @param options - Configuration including the job entity class
   * @returns Dynamic module configuration
   */
  static forRoot<T extends JobEntity = JobEntity>(
    options: QueueDatabaseModuleOptions<T>,
  ) {
    return super.forRoot(options);
  }

  /**
   * Registers the module with asynchronous options via factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static forRootAsync<T extends JobEntity = JobEntity>(
    options: ConfigurableModuleAsyncOptions<QueueDatabaseModuleOptions<T>>,
  ) {
    return super.forRootAsync(options);
  }
}
