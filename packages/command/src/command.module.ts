import { RequestContextModule } from "@nest-boot/request-context";
import { Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { CommandRegistry } from "./command.registry.js";

/** Import once in a CLI root module to discover commands in all imported modules. */
@Module({
  imports: [DiscoveryModule, RequestContextModule],
  providers: [CommandRegistry],
  exports: [CommandRegistry],
})
export class CommandModule {}
