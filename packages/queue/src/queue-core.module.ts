import { RequestContextModule } from "@nest-boot/request-context";
import { Global, Logger, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { QueueExplorer } from "./queue.explorer";
import { QueueManager } from "./queue.manager";

@Global()
@Module({
  imports: [RequestContextModule, DiscoveryModule],
  providers: [Logger, QueueExplorer, QueueManager],
  exports: [QueueExplorer, QueueManager],
})
export class QueueCoreModule {}
