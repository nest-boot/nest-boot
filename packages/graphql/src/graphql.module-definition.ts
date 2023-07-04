import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type GraphQLModuleOptions } from "./interfaces";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<GraphQLModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
