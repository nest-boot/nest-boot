import { MikroOrmModuleOptions as BaseMikroOrmModuleOptions } from "@mikro-orm/nestjs";

export type MikroOrmModuleOptions = Omit<
  BaseMikroOrmModuleOptions,
  "registerRequestContext"
>;
