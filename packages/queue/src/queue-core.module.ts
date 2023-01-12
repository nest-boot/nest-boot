import { Logger, Module } from "@nestjs/common";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";

import { QueueExplorer } from "./queue.explorer";
import { QueueManager } from "./queue.manager";

@Module({
  providers: [
    DiscoveryService,
    MetadataScanner,
    Logger,
    QueueExplorer,
    QueueManager,
  ],
  exports: [QueueManager],
})
export class QueueCoreModule {}
