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

function normalizeHostname(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }

  return hostname;
}

function loadQueryConfig(
  url: URL,
  dbType: string,
): Pick<HostConfig, "driverOptions" | "schema"> {
  const connection: Record<string, unknown> = Object.fromEntries(
    url.searchParams,
  );
  const schema = url.searchParams.get("schema") ?? undefined;

  delete connection.schema;

  if (connection.ssl === "true" || connection.ssl === "1") {
    connection.ssl = true;
  } else if (connection.ssl === "false" || connection.ssl === "0") {
    connection.ssl = false;
  }

  if (dbType === "postgres" || dbType === "postgresql") {
    switch (connection.sslmode) {
      case "disable":
        connection.ssl = false;
        break;
      case "no-verify":
        connection.ssl = { rejectUnauthorized: false };
        break;
      case "prefer":
      case "require":
      case "verify-ca":
      case "verify-full":
        connection.ssl = {};
        break;
    }
  }

  return {
    schema,
    driverOptions: Object.keys(connection).length ? { connection } : undefined,
  };
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
  /** Default database schema. */
  schema?: string;
  /** Driver connection options parsed from URL query parameters. */
  driverOptions?: Options["driverOptions"];
}

/**
 * Loads MikroORM configuration from environment variables.
 *
 * @remarks
 * Supports `DATABASE_URL`, which is parsed into individual connection options,
 * including structured query options. Its protocol resolves the database
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

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const url = new URL(databaseUrl);
    const dbType = url.protocol.replace(":", "");
    const dbName = url.pathname.slice(1);

    return {
      ...baseConfig,
      driver: await getDriver(dbType),
      host: normalizeHostname(url.hostname),
      port: url.port ? +url.port : undefined,
      dbName: dbName ? decodeURIComponent(dbName) : undefined,
      user: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      ...loadQueryConfig(url, dbType),
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
