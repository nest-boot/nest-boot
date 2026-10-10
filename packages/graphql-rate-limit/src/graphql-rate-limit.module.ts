import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import {
  type DynamicModule,
  Global,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Request } from "express";
import { Redis } from "ioredis";

import { GraphQLRateLimitDriver } from "./drivers/index.js";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./graphql-rate-limit.module-definition.js";
import { GraphQLRateLimitPlugin } from "./graphql-rate-limit.plugin.js";
import { GraphQLRateLimitStorage } from "./graphql-rate-limit.storage.js";
import {
  GraphQLRateLimitModuleOptions,
  GraphQLRateLimitOptions,
} from "./interfaces/index.js";
import { createGraphQLRateLimitDriver } from "./utils/create-driver.util.js";

/**
 * GraphQL rate limiting module using a pluggable leaky bucket driver.
 *
 * Provides query complexity analysis and rate limiting for GraphQL operations.
 * Reuses the Redis client provided by `@nest-boot/redis` by default and falls
 * back to process-local memory when no Redis client is available.
 *
 * The module can be imported directly without dynamic registration. It selects
 * a shared Redis client when RedisModule is registered and memory otherwise.
 * An explicit Redis `connection` creates a separate owned client, while an
 * explicit `driver` overrides all automatic selection. Configure `REDIS_URL`
 * through RedisModule; this module does not read environment connection options.
 */
@Global()
@Module({
  providers: [
    GraphQLRateLimitPlugin,
    GraphQLRateLimitStorage,
    {
      provide: GraphQLRateLimitDriver,
      inject: [OPTIONS_TOKEN, { token: Redis, optional: true }],
      useFactory: createGraphQLRateLimitDriver,
    },
    {
      provide: OPTIONS_TOKEN,
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (
        options?: GraphQLRateLimitModuleOptions,
      ): GraphQLRateLimitOptions => {
        return {
          driver: options?.driver,
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
  exports: [GraphQLRateLimitDriver, OPTIONS_TOKEN],
})
export class GraphQLRateLimitModule
  extends ConfigurableModuleClass
  implements OnApplicationShutdown
{
  /**
   * Registers the GraphQLRateLimitModule with the given options.
   * @param options - Configuration options including thresholds and storage driver
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

  /**
   * Creates a new GraphQLRateLimitModule instance.
   * @param driver - Selected rate limit storage driver
   */
  constructor(private readonly driver: GraphQLRateLimitDriver) {
    super();
  }

  /** Gracefully closes the selected driver when the application shuts down. */
  async onApplicationShutdown(): Promise<void> {
    await this.driver.close();
  }
}
