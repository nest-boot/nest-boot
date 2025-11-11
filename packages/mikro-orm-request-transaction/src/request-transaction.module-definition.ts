import { ConfigurableModuleBuilder } from "@nestjs/common";

import { RequestTransactionModuleOptions } from "./request-transaction-module-options.interface";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<RequestTransactionModuleOptions>()
    .setClassMethodName("forRoot")
    .build();
