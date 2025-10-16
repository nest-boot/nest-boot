import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type GraphQLRateLimitModuleOptions } from "./interfaces";

export const REDIS_COMMAND = "GRAPHQL_RATE_LIMIT";

export const OPTIONS_TOKEN = Symbol("GraphQLRateLimitOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<GraphQLRateLimitModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
