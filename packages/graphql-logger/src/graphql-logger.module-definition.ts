import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type GraphQLLoggerModuleOptions } from "./graphql-logger-module-options.interface";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<GraphQLLoggerModuleOptions>()
    .setClassMethodName("forRoot")
    .build();
