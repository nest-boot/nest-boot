import { DataloaderType } from "@mikro-orm/core";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

import type { MikroOrmModuleOptions } from "../interfaces/mikro-orm-module-options.interface.js";

/** Loads the framework defaults that do not select a database connection. */
export function loadDefaultConfig() {
  return {
    colors: false,
    debug: false,
    dataloader: DataloaderType.ALL,
    timezone: "UTC",
    metadataProvider: TsMorphMetadataProvider,
    entities: ["dist/**/*.entity.js"],
    entitiesTs: ["src/**/*.entity.ts"],
    migrations: {
      snapshot: false,
      path: "dist/database/migrations",
      pathTs: "src/database/migrations",
    },
    seeder: {
      path: "dist/database/seeders",
      pathTs: "src/database/seeders",
      defaultSeeder: "DatabaseSeeder",
      fileName: (className: string) => className,
    },
  } satisfies MikroOrmModuleOptions;
}
