import { BullModule as BaseBullModule } from "@nestjs/bullmq";
import { type DynamicModule, Global, Module } from "@nestjs/common";

import {
  type ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  type OPTIONS_TYPE,
} from "./bullmq.module-definition";
import { BullModuleOptions } from "./bullmq-module-options.interface";

@Global()
@Module({
  imports: [
    BaseBullModule.forRootAsync({
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options: BullModuleOptions = {}) => {
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
})
export class BullModule extends ConfigurableModuleClass {
  private static patchDynamicModule(
    dynamicModule: DynamicModule,
  ): DynamicModule {
    dynamicModule.exports = [MODULE_OPTIONS_TOKEN];
    return dynamicModule;
  }

  static forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return this.patchDynamicModule(super.forRoot(options));
  }

  static forRootAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return this.patchDynamicModule(super.forRootAsync(options));
  }

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
