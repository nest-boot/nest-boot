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

/** URL-based database connection configuration for explicit module options. */
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
 * Supports `DB_URL` and `DATABASE_URL`. The selected URL is parsed into
 * individual connection options, and its protocol resolves the database
 * driver.
 *
 * @returns MikroORM options derived from environment variables
 */
export async function loadConfigFromEnv(): Promise<DriverConfig & HostConfig> {
  const baseConfig = {
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
  } satisfies Options;

  const dbUrl = process.env.DB_URL ?? process.env.DATABASE_URL;

  if (dbUrl) {
    const url = new URL(dbUrl);
    const dbType = url.protocol.replace(":", "");
    const dbName = url.pathname.slice(1);

    return {
      ...baseConfig,
      driver: await getDriver(dbType),
      host: url.hostname,
      port: url.port ? +url.port : undefined,
      dbName: dbName ? decodeURIComponent(dbName) : undefined,
      user: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
    };
  }

  return {
    ...baseConfig,
    driver: undefined,
    host: undefined,
    port: undefined,
    dbName: undefined,
    user: undefined,
    password: undefined,
  };
}
