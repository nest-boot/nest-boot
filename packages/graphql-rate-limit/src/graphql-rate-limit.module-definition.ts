import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type GraphQLRateLimitModuleOptions } from "./interfaces/index.js";

/** Injection token for the resolved GraphQL rate limit options. */
export const OPTIONS_TOKEN = Symbol("GraphQLRateLimitOptions");

/**
 * Module definition for the GraphQL rate limit module.
 * @internal
 */
export const {
  /**
   * Base configurable module class.
   * @internal
   */
  ConfigurableModuleClass,
  /**
   * Module options injection token.
   * @internal
   */
  MODULE_OPTIONS_TOKEN,
  /**
   * Synchronous options type.
   * @internal
   */
  OPTIONS_TYPE,
  /**
   * Asynchronous options type.
   * @internal
   */
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<GraphQLRateLimitModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
