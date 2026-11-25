import { CommandModule } from "@nest-boot/command";
import { Module } from "@nestjs/common";

import { GreetingModule } from "./greeting.module.js";

@Module({ imports: [CommandModule, GreetingModule] })
export class AppModule {}
