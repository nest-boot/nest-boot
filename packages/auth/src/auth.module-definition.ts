import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type AuthModuleOptions } from "./interfaces";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<AuthModuleOptions>().build();
