import { Logger, Module } from "@nestjs/common";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";

import { ConfigurableModuleClass } from "./schedule.module-definition";
import { ScheduleService } from "./schedule.service";

@Module({
  providers: [DiscoveryService, MetadataScanner, Logger, ScheduleService],
  exports: [],
})
export class ScheduleModule extends ConfigurableModuleClass {}
