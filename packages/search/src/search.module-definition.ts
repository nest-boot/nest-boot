import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type SearchModuleOptions } from "./interfaces";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<SearchModuleOptions>().build();
