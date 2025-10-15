import { BullModule as BaseBullModule } from "@nestjs/bullmq";
import { type DynamicModule, Global, Module } from "@nestjs/common";

import {
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./bullmq.module-definition";
import { BullModuleOptions } from "./bullmq-module-options.interface";

@Global()
@Module({
  imports: [
    BaseBullModule.forRootAsync({
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: BullModuleOptions) => {
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
    }),
  ],
  providers: [
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options: BullModuleOptions = {}) => options,
    },
  ],
  exports: [MODULE_OPTIONS_TOKEN],
})
export class BullModule extends ConfigurableModuleClass {
  static registerQueue(
    ...args: Parameters<typeof BaseBullModule.registerQueue>
  ): DynamicModule {
    return BaseBullModule.registerQueue(...args);
  }

  static registerQueueAsync(
    ...args: Parameters<typeof BaseBullModule.registerQueueAsync>
  ): DynamicModule {
    return BaseBullModule.registerQueueAsync(...args);
  }
}
