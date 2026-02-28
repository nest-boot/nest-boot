import {
  Configuration,
  DataloaderType,
  IDatabaseDriver,
  type Options,
} from "@mikro-orm/core";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

async function getDriver(
  type?: string,
): Promise<(new (config: Configuration) => IDatabaseDriver) | undefined> {
  switch (type) {
    case "mysql":
      return (await import("@mikro-orm/mysql")).MySqlDriver;
    case "postgres":
    case "postgresql":
      return (await import("@mikro-orm/postgresql")).PostgreSqlDriver;
  }
}

/** Constructor type for a MikroORM database driver. */
export type DatabaseDriverConstructor = new (
  config: Configuration,
) => IDatabaseDriver;

/** Database driver configuration for MikroORM. */
export interface DriverConfig {
  /** Database driver class constructor. */
  driver?: DatabaseDriverConstructor;
}

/** URL-based database connection configuration. */
export interface UrlConfig {
  /** Database connection URL. */
  clientUrl?: string;
}

/** Host-based database connection configuration. */
export interface HostConfig {
  /** Database host. */
  host?: string;
  /** Database port. */
  port?: number;
  /** Database name. */
  dbName?: string;
  /** Database user. */
  user?: string;
  /** Database password. */
  password?: string;
}

/**
 * Loads MikroORM configuration from environment variables.
 *
 * @remarks
 * Supports both connection URL (`DB_URL` / `DATABASE_URL`) and individual
 * host/port/dbName/user/password variables. Automatically resolves the
 * database driver based on the URL protocol or `DB_TYPE`.
 *
 * @returns MikroORM options derived from environment variables
 */
export async function loadConfigFromEnv(): Promise<
  DriverConfig & (UrlConfig | HostConfig)
> {
  const baseConfig: Options = {
    colors: false,
    debug: !!(process.env.DB_DEBUG ?? process.env.DATABASE_DEBUG),
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
  };

  const dbUrl = process.env.DB_URL ?? process.env.DATABASE_URL;

  if (dbUrl) {
    const dbType = new URL(dbUrl).protocol.replace(":", "");

    return {
      ...baseConfig,
      driver: await getDriver(dbType),
      clientUrl: dbUrl,
    };
  }

  const dbType = process.env.DB_TYPE ?? process.env.DATABASE_TYPE;
  const dbHost = process.env.DB_HOST ?? process.env.DATABASE_HOST;
  const dbPort = process.env.DB_PORT ?? process.env.DATABASE_PORT;
  const dbName =
    process.env.DB_NAME ?? process.env.DB_DATABASE ?? process.env.DATABASE_NAME;
  const dbUsername =
    process.env.DB_USER ??
    process.env.DB_USERNAME ??
    process.env.DATABASE_USER ??
    process.env.DATABASE_USERNAME;
  const dbPassword =
    process.env.DB_PASS ??
    process.env.DB_PASSWORD ??
    process.env.DATABASE_PASS ??
    process.env.DATABASE_PASSWORD;

  return {
    ...baseConfig,
    driver: await getDriver(dbType),
    host: dbHost,
    port: dbPort ? +dbPort : undefined,
    dbName,
    user: dbUsername,
    password: dbPassword,
  };
}
