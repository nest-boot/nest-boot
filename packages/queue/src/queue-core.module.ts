import { Logger, Module } from "@nestjs/common";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";

import { QueueExplorer } from "./queue.explorer";

@Module({
  providers: [DiscoveryService, MetadataScanner, Logger, QueueExplorer],
  exports: [QueueExplorer],
})
export class QueueCoreModule {}
