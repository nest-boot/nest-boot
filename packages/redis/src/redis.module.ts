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
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: RedisOptions) => new Redis(options),
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
