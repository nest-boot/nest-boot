import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type GraphQLLoggerModuleOptions } from "./graphql-logger-module-options.interface";

/**
 * Injection token for GraphQLLoggerModule options.
 */
export const MODULE_OPTIONS_TOKEN = Symbol("GraphQLLoggerModuleOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<GraphQLLoggerModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
