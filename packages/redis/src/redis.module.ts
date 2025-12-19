import {
  type DynamicModule,
  Global,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import Redis, { type RedisOptions } from "ioredis";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./redis.module-definition";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

/**
 * Module that provides Redis connection using ioredis.
 *
 * The module automatically loads configuration from environment variables if not provided:
 * - `REDIS_URL`: Full Redis connection URL (e.g., redis://user:pass@host:6379/0)
 * - `REDIS_HOST`: Redis server hostname
 * - `REDIS_PORT`: Redis server port
 * - `REDIS_DB` or `REDIS_DATABASE`: Redis database number
 * - `REDIS_USER` or `REDIS_USERNAME`: Redis username
 * - `REDIS_PASS` or `REDIS_PASSWORD`: Redis password
 * - `REDIS_TLS`: Enable TLS connection
 *
 * @example
 * ```typescript
 * import { RedisModule } from '@nest-boot/redis';
 *
 * @Module({
 *   imports: [
 *     RedisModule.register({
 *       host: 'localhost',
 *       port: 6379,
 *       isGlobal: true,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @example
 * ```typescript
 * // Inject Redis client in your service
 * import { Redis } from 'ioredis';
 *
 * @Injectable()
 * export class CacheService {
 *   constructor(private readonly redis: Redis) {}
 *
 *   async get(key: string): Promise<string | null> {
 *     return this.redis.get(key);
 *   }
 * }
 * ```
 */
@Global()
@Module({
  providers: [
    {
      provide: Redis,
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options: RedisOptions) =>
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
  /**
   * Registers the RedisModule with the given options.
   * @param options - Redis connection options and isGlobal flag
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the RedisModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }

  /**
   * Creates an instance of RedisModule.
   * @param redis - The Redis client instance
   */
  constructor(private readonly redis: Redis) {
    super();
  }

  /**
   * Gracefully closes the Redis connection when the application shuts down.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
