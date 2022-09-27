import { Connection, IDatabaseDriver, Options } from "@mikro-orm/core";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

import { MigrationGenerator } from "../migration-generator";

export function databaseConfig<D extends IDatabaseDriver<Connection>>(
  options?: Options<D>
): Options<D> {
  return {
    debug:
      options?.debug ||
      !!process.env.DATABASE_DEBUG ||
      process.env.NODE_ENV !== "production",
    type: options?.type || (process.env.DATABASE_TYPE as Options<D>["type"]),
    host: options?.host || process.env.DATABASE_HOST,
    port: options?.port || +process.env.DATABASE_PORT,
    name: options?.name || process.env.DATABASE_USERNAME,
    password: options?.password || process.env.DATABASE_PASSWORD,
    timezone: options?.timezone || process.env.DATABASE_TIMEZONE || process.env.TZ,
    clientUrl:
      options?.clientUrl ||
      `${process.env.DATABASE_TYPE}://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}?application_name=${process.env.APP_NAME}`,
    dbName: options?.dbName || process.env.DATABASE_NAME,
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
  };
}
