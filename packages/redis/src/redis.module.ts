import { Global, Module, type Provider } from "@nestjs/common";
import Redis from "ioredis";

import { RedisModuleOptions } from "./interfaces/redis-module-options.interface";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./redis.module-definition";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

const RedisProvider: Provider<Redis> = {
  provide: Redis,
  inject: [MODULE_OPTIONS_TOKEN],
  useFactory: (options: RedisModuleOptions) => new Redis(options),
};

/**
 * Module that provides a Redis client using ioredis.
 * It automatically loads configuration from environment variables.
 */
@Global()
@Module({
  providers: [
    RedisProvider,
    {
      provide: MODULE_OPTIONS_TOKEN,
      inject: [{ token: BASE_MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options?: RedisModuleOptions) =>
        ({ ...loadConfigFromEnv(), ...options }) as RedisModuleOptions,
    },
  ],
  exports: [RedisProvider],
})
export class RedisModule extends ConfigurableModuleClass {}
