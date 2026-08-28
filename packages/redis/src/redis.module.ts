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
 * The module automatically loads and parses `REDIS_URL` when explicit options
 * are not provided (for example, `redis://user:pass@host:6379/0`).
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

  /** Creates a new RedisModule instance.
   * @param redis - The ioredis client instance
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
