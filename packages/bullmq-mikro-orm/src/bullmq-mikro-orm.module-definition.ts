import { ConfigurableModuleBuilder } from "@nestjs/common";

import { BullMQMikroORMModuleOptions } from "./bullmq-mikro-orm-module-options.interface";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<BullMQMikroORMModuleOptions>()
    .setClassMethodName("forRoot")
    .build();
