import { BullModule } from "@nestjs/bullmq";
import { type DynamicModule, Logger, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import {
  type ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  type OPTIONS_TYPE,
} from "./schedule.module-definition";
import { ScheduleProcessor } from "./schedule.processor";
import { ScheduleRegistry } from "./schedule.registry";
import { type ScheduleModuleOptions } from "./schedule-module-options.interface";

@Module({
  imports: [DiscoveryModule],
  providers: [Logger, ScheduleRegistry, ScheduleProcessor],
  exports: [],
})
export class ScheduleModule extends ConfigurableModuleClass {
  static register(options?: typeof OPTIONS_TYPE): DynamicModule {
    return this.withQueue(super.register(options ?? {}));
  }

  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return this.withQueue(super.registerAsync(options));
  }

  private static withQueue(dynamicModule: DynamicModule): DynamicModule {
    const ScheduleQueueDynamicModule = BullModule.registerQueueAsync({
      name: "schedule",
      imports: [dynamicModule],
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: ScheduleModuleOptions) => {
        return {
          connection: (() => {
            if (process.env.REDIS_URL) {
              const url = new URL(process.env.REDIS_URL);
              const port = url.port;
              const database = url.pathname.split("/")[1];

              return {
                host: url.hostname,
                port: port ? +port : undefined,
                database: database ? +database : undefined,
                username: url.username,
                password: url.password,
              };
            }

            const host = process.env.REDIS_HOST;
            const port = process.env.REDIS_PORT;
            const database = process.env.REDIS_DATABASE;
            const username = process.env.REDIS_USERNAME;
            const password = process.env.REDIS_PASSWORD;

            return {
              host,
              port: port ? +port : undefined,
              database: database ? +database : undefined,
              username,
              password,
            };
          })(),
          ...options,
        };
      },
    });

    dynamicModule.imports = [
      ...(dynamicModule.imports ?? []),
      ScheduleQueueDynamicModule,
    ];

    dynamicModule.exports = [MODULE_OPTIONS_TOKEN];

    return dynamicModule;
  }
}
