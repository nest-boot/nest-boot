import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type GraphQLModuleOptions } from "./interfaces";

export const MODULE_OPTIONS_TOKEN = Symbol("GraphQLModuleOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<GraphQLModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
