import { type IDatabaseDriver, type Options } from "@mikro-orm/core";
import { type NestApplicationContextOptions } from "@nestjs/common/interfaces/nest-application-context-options.interface";
import { NestFactory } from "@nestjs/core";

import { MODULE_OPTIONS_TOKEN } from "../database.module-definition";
import { withBaseConfig } from "./with-base-config.util";

export async function defineConfig<D extends IDatabaseDriver>(
  module: any,
  options?: NestApplicationContextOptions,
): Promise<Options<D>> {
  const app = await NestFactory.createApplicationContext(module, {
    logger: false,
    ...options,
  });

  const config: Options<D> = withBaseConfig(
    await app.get(MODULE_OPTIONS_TOKEN),
  );

  setTimeout(() => {
    void app.close();
  }, 3000);

  return config;
}
