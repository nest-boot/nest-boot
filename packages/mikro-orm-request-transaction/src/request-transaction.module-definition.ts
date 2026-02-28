import { ConfigurableModuleBuilder } from "@nestjs/common";

import { RequestTransactionModuleOptions } from "./request-transaction-module-options.interface";

/**
 * Module definition for the request-transaction module.
 * @internal
 */
export const {
  /** @internal Base configurable module class. */
  ConfigurableModuleClass,
  /** @internal Module options injection token. */
  MODULE_OPTIONS_TOKEN,
  /** @internal Synchronous options type. */
  OPTIONS_TYPE,
  /** @internal Asynchronous options type. */
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<RequestTransactionModuleOptions>()
  .setClassMethodName("forRoot")
  .build();
