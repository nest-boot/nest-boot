import { Connection, IDatabaseDriver, Options } from "@mikro-orm/core";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

import { MigrationGenerator } from "../migration-generator";

export function databaseConfig<D extends IDatabaseDriver<Connection>>(
  options: Options<D> = {}
): Options<D> {
  return {
    type: process.env.DATABASE_TYPE as Options<D>["type"],
    host: process.env.DATABASE_HOST,
    port:
      typeof process.env.DATABASE_PORT !== "undefined"
        ? +process.env.DATABASE_PORT
        : undefined,
    dbName: process.env.DATABASE_NAME,
    name: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    timezone: process.env.DATABASE_TIMEZONE ?? process.env.TZ,
    metadataProvider: TsMorphMetadataProvider,
    entities: ["dist/**/*.entity.js"],
    entitiesTs: ["src/**/*.entity.ts"],
    migrations: {
      snapshot: false,
      path: "dist/database/migrations",
      pathTs: "src/database/migrations",
      generator: MigrationGenerator,
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
