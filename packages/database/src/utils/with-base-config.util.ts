import { type IDatabaseDriver, type Options } from "@mikro-orm/core";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

// import { MigrationGenerator } from "../migration-generator";

export function withBaseConfig<D extends IDatabaseDriver>(
  options: Options<D>,
): Options<D> {
  return {
    timezone: "UTC",
    metadataProvider: TsMorphMetadataProvider,
    // entities: ["dist/**/*.entity.js"],
    // entitiesTs: ["src/**/*.entity.ts"],
    migrations: {
      snapshot: false,
      path: "dist/database/migrations",
      pathTs: "src/database/migrations",
      // generator: MigrationGenerator,
    },
    seeder: {
      path: "dist/database/seeders",
      pathTs: "src/database/seeders",
      defaultSeeder: "Seeder",
      fileName: (className: string) => className,
    },
    ...options,
  };
}
