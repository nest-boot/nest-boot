import { Module, type OnApplicationShutdown } from "@nestjs/common";
import { type RedisOptions } from "ioredis";

import { Redis } from "./redis";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./redis.module-definition";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

@Module({
  providers: [
    {
      provide: Redis,
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options: RedisOptions = {}) =>
        new Redis({
          ...loadConfigFromEnv(),
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
