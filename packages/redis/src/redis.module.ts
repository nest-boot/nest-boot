import { Module, type OnApplicationShutdown } from "@nestjs/common";
import { type RedisOptions } from "ioredis";

import { Redis } from "./redis";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./redis.module-definition";

@Module({
  providers: [
    {
      provide: Redis,
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options: RedisOptions = {}) =>
        new Redis({
          ...(() => {
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
        }),
    },
  ],
  exports: [Redis],
})
export class RedisModule
  extends ConfigurableModuleClass
  implements OnApplicationShutdown
{
  constructor(private readonly redis: Redis) {
    super();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
