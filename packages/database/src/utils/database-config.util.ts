import { Connection, IDatabaseDriver, Options } from "@mikro-orm/core";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

import { MigrationGenerator } from "../migration-generator";

export function databaseConfig<D extends IDatabaseDriver<Connection>>(
  options: Options<D> = {}
): Options<D> {
  return {
    debug:
      !!process.env.DATABASE_DEBUG || process.env.NODE_ENV !== "production",
    type: process.env.DATABASE_TYPE as Options<D>["type"],
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT ? +process.env.DATABASE_PORT : undefined,
    dbName: process.env.DATABASE_NAME,
    name: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    clientUrl: `${process.env.DATABASE_TYPE}://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}?application_name=${process.env.APP_NAME}`,
    timezone: process.env.DATABASE_TIMEZONE || process.env.TZ,
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
