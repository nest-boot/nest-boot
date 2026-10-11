import { Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { QueueRegistrar } from "./queue.registrar.js";

/** Shared runtime: importing QueueModule repeatedly must not start duplicate workers. */
@Module({ imports: [DiscoveryModule], providers: [QueueRegistrar] })
export class QueueRuntimeModule {}
