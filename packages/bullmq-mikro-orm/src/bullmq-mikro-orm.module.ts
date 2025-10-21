import { ConfigurableModuleAsyncOptions, Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { ConfigurableModuleClass } from "./bullmq-mikro-orm.module-definition";
import { BullMQMikroORMService } from "./bullmq-mikro-orm.service";
import { BullMQMikroORMModuleOptions } from "./bullmq-mikro-orm-module-options.interface";
import { JobEntity } from "./entities/job.entity";

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [BullMQMikroORMService],
})
export class BullMQMikroORMModule extends ConfigurableModuleClass {
  static forRoot<T extends JobEntity = JobEntity>(
    options: BullMQMikroORMModuleOptions<T>,
  ) {
    return super.forRoot(options);
  }

  static forRootAsync<T extends JobEntity = JobEntity>(
    options: ConfigurableModuleAsyncOptions<BullMQMikroORMModuleOptions<T>>,
  ) {
    return super.forRootAsync(options);
  }
}
