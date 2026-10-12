import { Module } from "@nestjs/common";

import { GreetingService } from "./greeting.service.js";
import { HelloCommand } from "./hello.command.js";

@Module({ providers: [GreetingService, HelloCommand] })
export class GreetingModule {}
