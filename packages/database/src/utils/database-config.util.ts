import { Connection, IDatabaseDriver, Options } from "@mikro-orm/core";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";
import path from "path";

import { MigrationGenerator } from "../migration-generator";

const resolve = (...args: string[]) => path.resolve(process.cwd(), ...args);

export function databaseConfig<D extends IDatabaseDriver<Connection>>(
  options: Options<D>
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
    clientUrl:
      options?.clientUrl ||
      `${process.env.DATABASE_TYPE}://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}`,
    dbName: options?.dbName || process.env.DATABASE_NAME,
    metadataProvider: TsMorphMetadataProvider,
    entities: [resolve("dist/app/core/entities/**/*.entity.js")],
    entitiesTs: [resolve("src/app/core/entities/**/*.entity.ts")],
    migrations: {
      path: resolve("dist/database/migrations"),
      pathTs: resolve("src/database/migrations"),
      generator: MigrationGenerator,
    },
    seeder: {
      path: resolve("dist/database/seeders"),
      pathTs: resolve("src/database/seeders"),
      defaultSeeder: "Seeder",
      fileName: (className: string) => className,
    },
  };
}
