import { ConfigurableModuleBuilder } from "@nestjs/common";

import { BullMQMikroORMModuleOptions } from "./bullmq-mikro-orm-module-options.interface";

/**
 * Injection token for BullMQMikroORMModule options.
 */
export const MODULE_OPTIONS_TOKEN = Symbol("BullMQMikroORMModuleOptions");

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN: BASE_OPTIONS } =
  new ConfigurableModuleBuilder<BullMQMikroORMModuleOptions>()
    .setClassMethodName("forRoot")
    .build();
