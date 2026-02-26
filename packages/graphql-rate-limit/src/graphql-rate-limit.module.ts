import { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { RedisModule } from "@nest-boot/redis";
import { Global, Module } from "@nestjs/common";
import { Request } from "express";

import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TOKEN,
} from "./graphql-rate-limit.module-definition";
import { GraphQLRateLimitPlugin } from "./graphql-rate-limit.plugin";
import { GraphQLRateLimitStorage } from "./graphql-rate-limit.storage";
import {
  GraphQLRateLimitModuleOptions,
  GraphQLRateLimitOptions,
} from "./interfaces";

/**
 * Module for GraphQL rate limiting using Redis and query complexity.
 *
 * It prevents abuse by limiting the complexity of GraphQL queries that a client can execute
 * within a certain time window.
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
export class GraphQLRateLimitModule extends ConfigurableModuleClass {}
