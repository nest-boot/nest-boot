import "source-map-support/register";

import { execCli } from "@nest-boot/command";

import { ConsoleModule } from "./app/console/console.module";

execCli(ConsoleModule);
