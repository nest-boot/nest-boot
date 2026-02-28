import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { RedisModule } from "@nest-boot/redis";
import { type DynamicModule, Global, Module } from "@nestjs/common";
import { Request } from "express";

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

/**
 * GraphQL rate limiting module using Redis-backed leaky bucket algorithm.
 *
 * @remarks
 * Provides query complexity analysis and rate limiting for GraphQL operations.
 * Uses Redis for distributed rate limit state and supports custom ID extraction.
 */
@Global()
@Module({
  imports: [
    RedisModule.registerAsync({
      inject: [OPTIONS_TOKEN],
      useFactory: (options: GraphQLRateLimitOptions) =>
        options.connection ?? {},
    }),
  ],
  providers: [
    GraphQLRateLimitPlugin,
    GraphQLRateLimitStorage,
    {
      provide: OPTIONS_TOKEN,
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (
        options?: GraphQLRateLimitModuleOptions,
      ): GraphQLRateLimitOptions => {
        return {
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
export class GraphQLRateLimitModule extends ConfigurableModuleClass {
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
}
