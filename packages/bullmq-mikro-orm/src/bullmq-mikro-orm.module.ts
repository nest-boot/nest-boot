import { DynamicModule, Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./bullmq-mikro-orm.module-definition";
import { BullMQMikroORMService } from "./bullmq-mikro-orm.service";
import { BullMQMikroORMModuleOptions } from "./bullmq-mikro-orm-module-options.interface";
import { JobEntity } from "./entities/job.entity";

/**
 * Module for persisting BullMQ jobs to a database using MikroORM.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [BullMQMikroORMService],
  exports: [BullMQMikroORMService],
})
export class BullMQMikroORMModule extends ConfigurableModuleClass {
  /**
   * Registers the module synchronously.
   *
   * @param options - Module options.
   * @returns Dynamic module.
   */
  static forRoot<T extends JobEntity = JobEntity>(
    options: BullMQMikroORMModuleOptions<T>,
  ): DynamicModule {
    return {
      module: BullMQMikroORMModule,
      providers: [
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
      ],
    };
  }

  /**
   * Registers the module asynchronously.
   *
   * @param options - Module async options.
   * @returns Dynamic module.
   */
  static forRootAsync<T extends JobEntity = JobEntity>(
    options: any, // Using any here to bypass strict typing issues with ConfigurableModuleAsyncOptions for now, or you can import it correctly
  ): DynamicModule {
    return super.forRootAsync(options);
  }
}
