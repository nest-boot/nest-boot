import { DynamicModule, Module } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule, Params } from "nestjs-pino";

import { defaultPinoOptions } from "./default-pino-options";

export type LoggerModuleOptions = Omit<Params, "pinoHttp">;

@Module({})
export class LoggerModule {
  static register(options?: LoggerModuleOptions): DynamicModule {
    const PinoLoggerDynamicModule = PinoLoggerModule.forRoot({
      ...options,
      pinoHttp: defaultPinoOptions,
    });

    return {
      module: LoggerModule,
      imports: [PinoLoggerDynamicModule],
    };
  }
}
