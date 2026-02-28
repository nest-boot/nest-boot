import { ConfigurableModuleAsyncOptions, Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { ConfigurableModuleClass } from "./bullmq-mikro-orm.module-definition";
import { BullMQMikroORMService } from "./bullmq-mikro-orm.service";
import { BullMQMikroORMModuleOptions } from "./bullmq-mikro-orm-module-options.interface";
import { JobEntity } from "./entities/job.entity";

/**
 * Module that integrates BullMQ job events with MikroORM persistence.
 *
 * @remarks
 * Subscribes to BullMQ queue events and automatically persists job state
 * changes to the database using the configured entity.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [BullMQMikroORMService],
})
export class BullMQMikroORMModule extends ConfigurableModuleClass {
  /**
   * Registers the module with synchronous options.
   * @param options - Configuration including the job entity class
   * @returns Dynamic module configuration
   */
  static forRoot<T extends JobEntity = JobEntity>(
    options: BullMQMikroORMModuleOptions<T>,
  ) {
    return super.forRoot(options);
  }

  /**
   * Registers the module with asynchronous options via factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static forRootAsync<T extends JobEntity = JobEntity>(
    options: ConfigurableModuleAsyncOptions<BullMQMikroORMModuleOptions<T>>,
  ) {
    return super.forRootAsync(options);
  }
}
