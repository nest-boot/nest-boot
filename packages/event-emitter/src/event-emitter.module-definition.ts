import { ConfigurableModuleBuilder } from "@nestjs/common";
import { randomUUID } from "crypto";
import { type RedisOptions } from "ioredis";

export const SUBSCRIBE_METADATA_KEY = randomUUID();

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<RedisOptions>()
  .setExtras(
    {
      isGlobal: true,
    },
    (definition, extras) => ({
      ...definition,
      global: extras.isGlobal,
    }),
  )
  .build();
