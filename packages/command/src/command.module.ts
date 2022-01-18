import { Module, OnModuleInit } from "@nestjs/common";
import { MetadataScanner } from "@nestjs/core";

import { CommandExplorerService } from "./command-explorer.service";
import { CommandService } from "./command.service";
import * as commands from "./commands";

@Module({
  providers: [
    CommandService,
    CommandExplorerService,
    MetadataScanner,
    ...Object.values(commands),
  ],
  exports: [CommandService],
})
export class CommandModule implements OnModuleInit {
  constructor(
    private readonly cliService: CommandService,
    private readonly commandExplorerService: CommandExplorerService
  ) {}

  onModuleInit(): void {
    this.cliService.initialize(this.commandExplorerService.explore());
  }
}
