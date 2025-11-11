import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type AuthRlsModuleOptions } from "./auth-rls-module-options.interface";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<AuthRlsModuleOptions>()
    .setClassMethodName("forRoot")
    .build();
