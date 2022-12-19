import { ConfigurableModuleBuilder } from "@nestjs/common";

import { CommonModuleOptions } from "./interfaces";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<CommonModuleOptions>().build();
