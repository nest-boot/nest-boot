import { ConfigurableModuleBuilder } from "@nestjs/common";

import { RequestTransactionModuleOptions } from "./request-transaction-module-options.interface";

/**
 * Injection token for RequestTransactionModule options.
 */
export const MODULE_OPTIONS_TOKEN = Symbol("RequestTransactionModuleOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<RequestTransactionModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
