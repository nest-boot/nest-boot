import { MikroOrmModuleOptions as BaseMikroOrmModuleOptions } from "@mikro-orm/nestjs";

/** Configuration options for the MikroORM module (excludes context management handled internally). */
export type MikroOrmModuleOptions = Omit<
  BaseMikroOrmModuleOptions,
  "registerRequestContext" | "context"
>;
