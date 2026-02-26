import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type RedisModuleOptions } from "./interfaces/redis-module-options.interface";

/**
 * Injection token for RedisModule options.
 */
export const MODULE_OPTIONS_TOKEN = Symbol("RedisModuleOptions");

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: BASE_MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<RedisModuleOptions>()
  .setClassMethodName("register")
  .build();
