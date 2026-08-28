import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  Configuration,
  DataloaderType,
  IDatabaseDriver,
  type Options,
} from "@mikro-orm/core";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

/** Constructor type for a MikroORM database driver. */
export type DatabaseDriverConstructor = new (
  config: Configuration,
) => IDatabaseDriver;

async function getDriver(protocol: string): Promise<DatabaseDriverConstructor> {
  switch (protocol) {
    case "file:":
      return (await import("@mikro-orm/better-sqlite")).BetterSqliteDriver;
    case "mysql:":
      return (await import("@mikro-orm/mysql")).MySqlDriver;
    case "postgres:":
    case "postgresql:":
      return (await import("@mikro-orm/postgresql")).PostgreSqlDriver;
    default:
      throw new TypeError(
        `Unsupported DATABASE_URL protocol: ${protocol || "(missing)"}`,
      );
  }
}

function normalizeHostname(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }

  return hostname;
}

async function loadPostgreSqlTlsFiles(
  connection: Record<string, unknown>,
): Promise<void> {
  const ssl =
    typeof connection.ssl === "object" && connection.ssl !== null
      ? (connection.ssl as Record<string, unknown>)
      : {};
  const tlsFiles = [
    ["sslrootcert", "ca"],
    ["sslcert", "cert"],
    ["sslkey", "key"],
  ] as const;
  let hasTlsFile = false;

  for (const [queryKey, sslKey] of tlsFiles) {
    const path = connection[queryKey];

    if (typeof path === "string" && path) {
      ssl[sslKey] = await readFile(path, "utf8");
      hasTlsFile = true;
    }
  }

  delete connection.sslrootcert;
  delete connection.sslcert;
  delete connection.sslkey;

  if (hasTlsFile) {
    connection.ssl = ssl;
  }
}

async function loadQueryConfig(
  url: URL,
  protocol: string,
): Promise<Pick<HostConfig, "driverOptions" | "schema">> {
  const connection: Record<string, unknown> = {};

  url.searchParams.forEach((value, key) => {
    if (protocol === "mysql:") {
      try {
        connection[key] = JSON.parse(value) as unknown;
      } catch {
        connection[key] = value;
      }
    } else {
      connection[key] = value;
    }
  });

  const schema = url.searchParams.get("schema") ?? undefined;

  delete connection.schema;

  if (protocol === "postgres:" || protocol === "postgresql:") {
    if (connection.ssl === "true" || connection.ssl === "1") {
      connection.ssl = true;
    } else if (connection.ssl === "0") {
      connection.ssl = false;
    }

    await loadPostgreSqlTlsFiles(connection);

    switch (connection.sslmode) {
      case "disable":
        connection.ssl = false;
        break;
      case "no-verify":
        connection.ssl = {
          ...(typeof connection.ssl === "object" && connection.ssl !== null
            ? connection.ssl
            : {}),
          rejectUnauthorized: false,
        };
        break;
      case "prefer":
      case "require":
      case "verify-ca":
      case "verify-full":
        if (typeof connection.ssl !== "object" || connection.ssl === null) {
          connection.ssl = {};
        }
        break;
    }

    delete connection.sslmode;
  }

  return {
    schema,
    driverOptions: Object.keys(connection).length ? { connection } : undefined,
  };
}

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
 * including structured query options. The `postgresql:` and `postgres:`
 * protocols select PostgreSQL, `mysql:` selects MySQL, and `file:` selects
 * SQLite.
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
    const driver = await getDriver(url.protocol);

    if (url.protocol === "file:") {
      return {
        ...baseConfig,
        driver,
        dbName: fileURLToPath(url),
      };
    }

    const dbName = url.pathname.slice(1);

    return {
      ...baseConfig,
      driver,
      host: normalizeHostname(url.hostname),
      port: +url.port,
      dbName: dbName ? decodeURIComponent(dbName) : undefined,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ...(await loadQueryConfig(url, url.protocol)),
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
