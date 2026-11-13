import { Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { DatabaseEntityRegistry } from "./database-entity-registry.js";

/** Shared entity collector scoped to the current Nest application. */
@Module({
  imports: [DiscoveryModule],
  providers: [DatabaseEntityRegistry],
  exports: [DatabaseEntityRegistry],
})
export class DatabaseEntityRegistryModule {}
