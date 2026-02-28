import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type GraphQLRateLimitModuleOptions } from "./interfaces";

/** Redis command name used by the rate limiter. */
export const REDIS_COMMAND = "GRAPHQL_RATE_LIMIT";

/** Injection token for the resolved GraphQL rate limit options. */
export const OPTIONS_TOKEN = Symbol("GraphQLRateLimitOptions");

/**
 * Module definition for the GraphQL rate limit module.
 * @internal
 */
export const {
  /** @internal Base configurable module class. */
  ConfigurableModuleClass,
  /** @internal Module options injection token. */
  MODULE_OPTIONS_TOKEN,
  /** @internal Synchronous options type. */
  OPTIONS_TYPE,
  /** @internal Asynchronous options type. */
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<GraphQLRateLimitModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
