import type { ForkOptions } from "@mikro-orm/core";
import { MikroOrmModuleOptions as BaseMikroOrmModuleOptions } from "@mikro-orm/nestjs";

/** Configuration options for the MikroORM module (excludes context management handled internally). */
export type MikroOrmModuleOptions = Omit<
  BaseMikroOrmModuleOptions,
  "registerRequestContext" | "context"
> & {
  /**
   * Creates the native database session for each request-scoped EntityManager.
   * Runs synchronously inside RequestContext, before authentication middleware.
   * Return undefined to leave the fork without an explicit session override.
   */
  session?: () => ForkOptions["session"];
};
