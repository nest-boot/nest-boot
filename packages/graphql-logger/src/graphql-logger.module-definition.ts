import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type GraphQLLoggerModuleOptions } from "./graphql-logger-module-options.interface";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<GraphQLLoggerModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
