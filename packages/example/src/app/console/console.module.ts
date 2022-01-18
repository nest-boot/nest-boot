import { CommandModule } from "@nest-boot/command";
import { Module } from "@nestjs/common";

import { CoreModule } from "../core/core.module";
import { SendMailCommand } from "./commands/send-mail.command";
import { UserCommand } from "./commands/user.command";

@Module({
  imports: [CoreModule, CommandModule],
  providers: [UserCommand, SendMailCommand],
})
export class ConsoleModule {}
