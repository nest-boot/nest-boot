import { DynamicModule, Global, Module } from "@nestjs/common";

import { Logger } from "../services/logger.service";

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class LoggerModule {
  static register(): DynamicModule {
    return {
      global: true,
      module: LoggerModule,
      providers: [Logger],
      exports: [Logger],
    };
  }
}
