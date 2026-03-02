import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import {
  type DynamicModule,
  Global,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Request } from "express";
import Redis from "ioredis";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./graphql-rate-limit.module-definition";
import { GraphQLRateLimitPlugin } from "./graphql-rate-limit.plugin";
import { GraphQLRateLimitStorage } from "./graphql-rate-limit.storage";
import {
  GraphQLRateLimitModuleOptions,
  GraphQLRateLimitOptions,
} from "./interfaces";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

/**
 * GraphQL rate limiting module using Redis-backed leaky bucket algorithm.
 *
 * @remarks
 * Provides query complexity analysis and rate limiting for GraphQL operations.
 * Uses Redis for distributed rate limit state and supports custom ID extraction.
 *
 * The module automatically loads Redis connection from environment variables if not provided:
 * - `REDIS_URL`: Full Redis connection URL (e.g., `redis://user:pass@host:6379/0`)
 * - `REDIS_HOST`: Redis server hostname
 * - `REDIS_PORT`: Redis server port
 * - `REDIS_DB` or `REDIS_DATABASE`: Redis database number
 * - `REDIS_USER` or `REDIS_USERNAME`: Redis username
 * - `REDIS_PASS` or `REDIS_PASSWORD`: Redis password
 * - `REDIS_TLS`: Enable TLS connection
 */
@Global()
@Module({
  providers: [
    GraphQLRateLimitPlugin,
    GraphQLRateLimitStorage,
    {
      provide: Redis,
      inject: [OPTIONS_TOKEN],
      useFactory: (options: GraphQLRateLimitOptions) =>
        new Redis({
          ...loadConfigFromEnv(),
          ...options.connection,
        }),
    },
    {
      provide: OPTIONS_TOKEN,
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (
        options?: GraphQLRateLimitModuleOptions,
      ): GraphQLRateLimitOptions => {
        return {
          connection: options?.connection,
          maxComplexity: options?.maxComplexity ?? 1000,
          defaultComplexity: options?.defaultComplexity ?? 0,
          keyPrefix: options?.keyPrefix ?? "graphql-rate-limit",
          restoreRate: options?.restoreRate ?? 50,
          maximumAvailable: options?.maximumAvailable ?? 1000,
          getId:
            options?.getId ??
            ((args: GraphQLRequestContext<BaseContext>) => {
              const req = (args.contextValue as { req: Request }).req;
              const ip = req.ips.length ? req.ips[0] : req.ip;

              if (typeof ip === "undefined") {
                throw new Error(
                  "Unable to determine client IP address for rate limiting. Please ensure the Express 'trust proxy' setting is configured correctly or provide a custom 'getId' function in the module options.",
                );
              }

              return ip;
            }),
        };
      },
    },
  ],
  exports: [OPTIONS_TOKEN],
})
export class GraphQLRateLimitModule
  extends ConfigurableModuleClass
  implements OnApplicationShutdown
{
  /**
   * Registers the GraphQLRateLimitModule with the given options.
   * @param options - Configuration options including rate limit thresholds and Redis connection
   * @returns Dynamic module configuration
   */
  static override forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.forRoot(options);
  }

  /**
   * Registers the GraphQLRateLimitModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.forRootAsync(options);
  }

  /** Creates a new GraphQLRateLimitModule instance.
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
