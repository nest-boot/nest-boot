import { ConfigurableModuleBuilder } from "@nestjs/common";

import { GraphQLModuleOptions } from "./graphql-module-options.interface";

/**
 * Injection token for GraphQLModule options.
 */
export const MODULE_OPTIONS_TOKEN = Symbol("GraphQLModuleOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<GraphQLModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
