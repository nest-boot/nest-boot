import { RequestContextModule } from "@nest-boot/request-context";
import { Global, Logger, Module } from "@nestjs/common";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";

import { JobEntityService } from "./job-entity.service";
import { QueueExplorer } from "./queue.explorer";
import { QueueManager } from "./queue.manager";

@Global()
@Module({
  imports: [RequestContextModule],
  providers: [
    DiscoveryService,
    MetadataScanner,
    Logger,
    QueueExplorer,
    QueueManager,
    JobEntityService,
  ],
  exports: [QueueExplorer, QueueManager],
})
export class QueueCoreModule {}
