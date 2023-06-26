import { type EntityManager } from "@mikro-orm/core";
import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type SearchModuleOptions } from "./interfaces";

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<
    SearchModuleOptions<{ id: number | string | bigint }, EntityManager>
  >()
    .setExtras(
      {
        isGlobal: true,
      },
      (definition, extras) => ({
        ...definition,
        global: extras.isGlobal,
      })
    )
    .build();
