import { ConfigurableModuleBuilder } from "@nestjs/common";

export const { ConfigurableModuleClass, OPTIONS_TYPE, ASYNC_OPTIONS_TYPE } =
  new ConfigurableModuleBuilder().build();
