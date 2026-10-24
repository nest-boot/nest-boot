import { Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { QueueStartCommand } from "./commands/queue-start.command.js";
import { QueueHealthIndicator } from "./queue.health-indicator.js";
import { QueueManager } from "./queue.manager.js";

/** Redis queues, event readers and explicitly started Workers. */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [QueueManager, QueueHealthIndicator, QueueStartCommand],
  exports: [QueueManager, QueueHealthIndicator],
})
export class QueueModule {}
