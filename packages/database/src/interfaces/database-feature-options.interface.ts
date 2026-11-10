import type { Options } from "@mikro-orm/core";
import type { FactoryProvider, ModuleMetadata } from "@nestjs/common";

/** Entity registrations resolved before ORM discovery, using only configuration dependencies. */
export interface DatabaseFeatureOptions extends Pick<
  ModuleMetadata,
  "imports"
> {
  /** Singleton configuration providers visible through the imported modules. */
  inject?: FactoryProvider["inject"];
  /** Resolves the feature's entity list without depending on MikroORM or EntityManager. */
  useFactory: (
    ...dependencies: any[]
  ) => Options["entities"] | Promise<Options["entities"]>;
  /** Database connection receiving the registrations. Defaults to the default connection. */
  contextName?: string;
}
