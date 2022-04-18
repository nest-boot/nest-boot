import { CommandModule } from "@nest-boot/command";
import { Module } from "@nestjs/common";

import { CoreModule } from "../core/core.module";
import { UserCommand } from "./commands/user.command";

@Module({
  imports: [CoreModule, CommandModule],
  providers: [UserCommand],
})
export class ConsoleModule {}
