import { ConfigurableModuleBuilder } from "@nestjs/common";
import { AuthModuleOptions } from "./interfaces/auth-module-options.interface";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<AuthModuleOptions>().build();
