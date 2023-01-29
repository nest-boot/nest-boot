import { Module } from "@nestjs/common";

import { ConfigurableModuleClass } from "./logger.module-definition";
import { Logger } from "./logger.service";
import { RequestLogger } from "./request-logger.service";

@Module({
  providers: [Logger, RequestLogger],
  exports: [Logger],
})
export class LoggerModule extends ConfigurableModuleClass {}
